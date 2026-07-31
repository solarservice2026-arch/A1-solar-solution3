import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { paginationSchema, staffSchema } from "@a1/validation";
import { asyncHandler, AppError, success } from "../lib/http.js";
import { requireAuth, requirePermission } from "./middleware.js";

export const authRouter=Router();
authRouter.get("/me",requireAuth,asyncHandler(async(req,res)=>{
  const anon=process.env.SUPABASE_ANON_KEY, url=process.env.SUPABASE_URL;
  const token=req.header("authorization")?.slice(7);
  if(!anon||!url||!token) throw new AppError(503,"Authentication service is not configured","SERVICE_UNAVAILABLE");
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data,error}=await userClient.from("profiles").select("id,full_name,phone,active,last_login_at").eq("id",req.auth!.userId).single();
  if(error) throw new AppError(404,"Profile not found","PROFILE_NOT_FOUND");
  return success(res,"Current user retrieved",{user:{...data,email:req.auth!.email},roles:req.auth!.roles,permissions:req.auth!.permissions});
}));

export const usersRouter=Router();
usersRouter.use(requireAuth);
usersRouter.get("/",requirePermission("users:view"),asyncHandler(async(req,res)=>{
  const query=paginationSchema.parse({page:req.query.page,pageSize:req.query.limit,search:req.query.search});
  const admin=adminClient(); const start=(query.page-1)*query.pageSize;
  let builder=admin.from("profiles").select("id,full_name,phone,active,last_login_at,created_at,user_roles(roles(name))",{count:"exact"}).is("archived_at",null);
  if(query.search) builder=builder.ilike("full_name",`%${query.search.replace(/[%_]/g,"")}%`);
  const {data,count,error}=await builder.range(start,start+query.pageSize-1).order("created_at",{ascending:false});
  if(error) throw new AppError(500,"Unable to load users","DATABASE_ERROR");
  return success(res,"Users retrieved",data,{page:query.page,limit:query.pageSize,total:count??0});
}));
usersRouter.post("/",requirePermission("users:create"),asyncHandler(async(req,res)=>{
  const input=staffSchema.parse(req.body); const admin=adminClient();
  assertRoleGrantAllowed(req.auth!.roles,input.role);
  const {data:role}=await admin.from("roles").select("id,name").eq("name",input.role).single();
  if(!role) throw new AppError(400,"Unknown role","INVALID_ROLE");
  const {data:created,error}=await admin.auth.admin.inviteUserByEmail(input.email,{data:{full_name:input.fullName}});
  if(error||!created.user) throw new AppError(400,error?.message??"Unable to invite staff","INVITE_FAILED");
  const {error:profileError}=await admin.from("profiles").upsert({id:created.user.id,full_name:input.fullName,phone:input.phone??null,active:input.active});
  if(profileError) throw new AppError(500,"Staff profile could not be created","DATABASE_ERROR");
  await admin.from("user_roles").insert({user_id:created.user.id,role_id:role.id});
  await audit(admin,req.auth!.userId,"staff.invited",created.user.id,{role:role.name});
  return success(res.status(201),"Staff invitation sent",{id:created.user.id,email:input.email});
}));
usersRouter.patch("/:id/status",requirePermission("users:disable"),asyncHandler(async(req,res)=>{
  const active=req.body.active;
  if(typeof active!=="boolean") throw new AppError(400,"Active status must be boolean","VALIDATION_ERROR");
  await assertEditable(req.auth!.userId,String(req.params.id),req.auth!.roles);
  const admin=adminClient();
  const {error}=await admin.from("profiles").update({active}).eq("id",req.params.id);
  if(error) throw new AppError(500,"Unable to update account","DATABASE_ERROR");
  return success(res,"Account status updated",{id:req.params.id,active});
}));
usersRouter.get("/:id",requirePermission("users:view"),asyncHandler(async(req,res)=>{
  const admin=adminClient();
  const {data,error}=await admin.from("profiles").select("id,full_name,phone,active,last_login_at,created_at,user_roles(role_id,roles(id,name,description,role_permissions(permissions(id,key,description))))").eq("id",req.params.id).single();
  if(error||!data) throw new AppError(404,"Staff member not found","NOT_FOUND");
  return success(res,"Staff member retrieved",data);
}));
usersRouter.patch("/:id",requirePermission("users:update"),asyncHandler(async(req,res)=>{
  await assertEditable(req.auth!.userId,String(req.params.id),req.auth!.roles); const fullName=String(req.body.fullName??"").trim();
  if(fullName.length<2||fullName.length>120) throw new AppError(400,"Valid full name is required","VALIDATION_ERROR");
  const admin=adminClient();const {error}=await admin.from("profiles").update({full_name:fullName,phone:req.body.phone??null}).eq("id",req.params.id);
  if(error) throw new AppError(500,"Unable to update staff","DATABASE_ERROR");
  await audit(admin,req.auth!.userId,"staff.updated",String(req.params.id),{fullName});
  return success(res,"Staff updated",{id:req.params.id});
}));
usersRouter.post("/:id/activate",requirePermission("users:update"),statusAction(true));
usersRouter.post("/:id/disable",requirePermission("users:disable"),statusAction(false));
usersRouter.delete("/:id",requirePermission("users:remove"),asyncHandler(async(req,res)=>{
 const id=String(req.params.id),admin=adminClient();await assertEditable(req.auth!.userId,id,req.auth!.roles);
 const {error}=await admin.from("profiles").update({active:false,archived_at:new Date().toISOString(),archived_by:req.auth!.userId}).eq("id",id);
 if(error)throw new AppError(500,"Unable to archive account","DATABASE_ERROR");
 const {error:authError}=await admin.auth.admin.updateUserById(id,{ban_duration:"876000h"});
 if(authError)throw new AppError(500,"Account archived but session revocation failed","SESSION_REVOCATION_FAILED");
 await audit(admin,req.auth!.userId,"staff.archived",id,{active:false,archived:true});
 return success(res,"Account archived",{id,archived:true});
}));
usersRouter.post("/:id/roles",requirePermission("users:assign_roles"),asyncHandler(async(req,res)=>{
  await assertEditable(req.auth!.userId,String(req.params.id),req.auth!.roles); const roleId=String(req.body.roleId??"");
  const admin=adminClient();const {data:role}=await admin.from("roles").select("id,name").eq("id",roleId).single();
  if(!role) throw new AppError(400,"Role not found","INVALID_ROLE");
  assertRoleGrantAllowed(req.auth!.roles,role.name);
  const {error}=await admin.from("user_roles").upsert({user_id:req.params.id,role_id:roleId});
  if(error) throw new AppError(500,"Unable to assign role","DATABASE_ERROR");
  await audit(admin,req.auth!.userId,"staff.role_assigned",String(req.params.id),{roleId});
  return success(res,"Role assigned",{userId:req.params.id,roleId});
}));
usersRouter.delete("/:id/roles/:roleId",requirePermission("users:assign_roles"),asyncHandler(async(req,res)=>{
  await assertEditable(req.auth!.userId,String(req.params.id),req.auth!.roles);const admin=adminClient();
  const {data:role}=await admin.from("roles").select("name").eq("id",req.params.roleId).single();
  if(role) assertRoleGrantAllowed(req.auth!.roles,role.name);
  if(role?.name==="super_admin"){
    if(!req.auth!.roles.includes("super_admin")) throw new AppError(403,"Protected role","PROTECTED_ROLE");
    await ensureAnotherActiveSuperAdmin(admin,String(req.params.id),String(req.params.roleId));
  }
  await admin.from("user_roles").delete().eq("user_id",req.params.id).eq("role_id",req.params.roleId);
  await audit(admin,req.auth!.userId,"staff.role_removed",String(req.params.id),{roleId:req.params.roleId});
  return success(res,"Role removed",{userId:req.params.id,roleId:req.params.roleId});
}));
usersRouter.get("/:id/permissions",requirePermission("users:view"),asyncHandler(async(req,res)=>{
  const admin=adminClient();const {data}=await admin.from("user_roles").select("roles(name,role_permissions(permissions(key,description)))").eq("user_id",req.params.id);
  const effective=new Map<string,string>();for(const row of data??[]){const role=row.roles as unknown as {role_permissions:Array<{permissions:{key:string,description:string}|null}>}|null;for(const rp of role?.role_permissions??[])if(rp.permissions)effective.set(rp.permissions.key,rp.permissions.description)}
  return success(res,"Effective permissions retrieved",[...effective].map(([key,description])=>({key,description})));
}));

export const rolesRouter=Router();rolesRouter.use(requireAuth);
rolesRouter.get("/",requirePermission("roles:view"),asyncHandler(async(_req,res)=>{const {data,error}=await adminClient().from("roles").select("id,name,description,role_permissions(permissions(id,key,description)),user_roles(count)").order("name");if(error)throw new AppError(500,"Unable to load roles","DATABASE_ERROR");return success(res,"Roles retrieved",data)}));
rolesRouter.get("/permissions",requirePermission("roles:view"),asyncHandler(async(_req,res)=>{const {data,error}=await adminClient().from("permissions").select("id,key,description").order("key");if(error)throw new AppError(500,"Unable to load permissions","DATABASE_ERROR");return success(res,"Permissions retrieved",data)}));
rolesRouter.get("/:id",requirePermission("roles:view"),asyncHandler(async(req,res)=>{const {data,error}=await adminClient().from("roles").select("id,name,description,role_permissions(permissions(id,key,description)),user_roles(user_id,profiles(full_name,active))").eq("id",req.params.id).single();if(error)throw new AppError(404,"Role not found","NOT_FOUND");return success(res,"Role retrieved",data)}));
rolesRouter.post("/:id/permissions",requirePermission("roles:assign_permissions"),asyncHandler(async(req,res)=>{const permissionId=String(req.body.permissionId??"");const admin=adminClient();await admin.from("role_permissions").upsert({role_id:req.params.id,permission_id:permissionId});await audit(admin,req.auth!.userId,"role.permission_assigned",String(req.params.id),{permissionId});return success(res,"Permission assigned",{roleId:req.params.id,permissionId})}));
rolesRouter.delete("/:id/permissions/:permissionId",requirePermission("roles:assign_permissions"),asyncHandler(async(req,res)=>{const admin=adminClient();await admin.from("role_permissions").delete().eq("role_id",req.params.id).eq("permission_id",req.params.permissionId);await audit(admin,req.auth!.userId,"role.permission_removed",String(req.params.id),{permissionId:req.params.permissionId});return success(res,"Permission removed",{roleId:req.params.id,permissionId:req.params.permissionId})}));

function statusAction(active:boolean){return asyncHandler(async(req,res)=>{const id=String(req.params.id),admin=adminClient();await assertEditable(req.auth!.userId,id,req.auth!.roles);if(!active){const {data:assignment}=await admin.from("user_roles").select("role_id,roles(name)").eq("user_id",id);const superRole=assignment?.find(r=>(r.roles as unknown as {name:string}|null)?.name==="super_admin");if(superRole)await ensureAnotherActiveSuperAdmin(admin,id,String(superRole.role_id))}const {error}=await admin.from("profiles").update({active}).eq("id",id);if(error)throw new AppError(500,"Unable to update account","DATABASE_ERROR");await audit(admin,req.auth!.userId,active?"staff.activated":"staff.disabled",id,{active});return success(res,active?"Staff activated":"Staff disabled",{id,active})})}
async function assertEditable(actorId:string,targetId:string,actorRoles:string[]){
 if(actorId===targetId)throw new AppError(403,"You cannot change your own protected access","SELF_PRIVILEGE_CHANGE");
 const admin=adminClient();const {data}=await admin.from("user_roles").select("roles(name)").eq("user_id",targetId);
 const targetRoles=(data??[]).map(r=>(r.roles as unknown as {name:string}|null)?.name).filter(Boolean) as string[];
 if(targetRoles.includes("super_admin"))throw new AppError(403,"Super Admin is protected","PROTECTED_ACCOUNT");
 if(!actorRoles.includes("super_admin")&&targetRoles.includes("admin"))throw new AppError(403,"Only Super Admin can manage Admin accounts","PROTECTED_ACCOUNT");
}
function assertRoleGrantAllowed(actorRoles:string[],role:string){
 if(role==="super_admin")throw new AppError(403,"Super Admin role cannot be granted through user management","PROTECTED_ROLE");
 if(actorRoles.includes("super_admin"))return;
 const operational=new Set(["manager","sales_executive","installation_staff","service_technician","accountant","customer"]);
 if(!actorRoles.includes("admin")||!operational.has(role))throw new AppError(403,"You cannot assign this role","PROTECTED_ROLE");
}
async function ensureAnotherActiveSuperAdmin(admin:ReturnType<typeof adminClient>,targetId:string,roleId:string){const {data:assignments}=await admin.from("user_roles").select("user_id").eq("role_id",roleId).neq("user_id",targetId);const ids=(assignments??[]).map(x=>x.user_id);if(ids.length===0)throw new AppError(409,"The final active Super Admin cannot be changed","FINAL_SUPER_ADMIN");const {count}=await admin.from("profiles").select("id",{count:"exact",head:true}).eq("active",true).in("id",ids);if((count??0)<1)throw new AppError(409,"The final active Super Admin cannot be changed","FINAL_SUPER_ADMIN")}
async function audit(admin:ReturnType<typeof adminClient>,actor:string,action:string,entity:string,newValues:object){await admin.from("audit_logs").insert({actor_user_id:actor,action,entity_type:"profile",entity_id:entity,new_values:newValues})}
function adminClient(){
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new AppError(503,"Supabase is not configured","SERVICE_UNAVAILABLE");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

