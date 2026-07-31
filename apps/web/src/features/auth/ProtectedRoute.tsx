import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
export function ProtectedRoute({permission}:{permission?:string}){
  const {user,loading}=useAuth();const location=useLocation();
  if(loading)return <main className="auth-state"><div className="spinner"/><p>Restoring your secure session…</p></main>;
  if(!user)return <Navigate to="/login" replace state={{from:location.pathname}}/>;
  if(!user.active)return <Navigate to="/forbidden" replace/>;
  if(permission&&!user.roles?.includes("super_admin")&&!user.roles?.includes("admin")&&!user.permissions?.includes(permission))return <Navigate to="/forbidden" replace/>;
  return <Outlet/>;
}
