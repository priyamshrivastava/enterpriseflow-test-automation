import { useEffect, useState } from 'react';
import axios from 'axios';
import { LayoutDashboard, Users, CalendarDays, BriefcaseBusiness, Shield, LogOut, Search, Plus } from 'lucide-react';
import './App.css';

const api=axios.create({baseURL:'http://localhost:8080/api'});
type Employee={id?:number;employeeId:string;firstName:string;lastName:string;email:string;phone:string;department:string;jobTitle:string;joiningDate:string;status:string};
const nav: [string, typeof LayoutDashboard][]=[['Dashboard',LayoutDashboard],['Employees',Users],['Leave',CalendarDays],['Recruitment',BriefcaseBusiness],['Admin',Shield]];

function App(){
 const [logged,setLogged]=useState(false);
 const [page,setPage]=useState('Employees');
 const [employees,setEmployees]=useState<Employee[]>([]);
 const [search,setSearch]=useState('');
 const [show,setShow]=useState(false);
 const [form,setForm]=useState<Employee>({employeeId:'',firstName:'',lastName:'',email:'',phone:'',department:'',jobTitle:'',joiningDate:'2026-01-01',status:'Active'});
 useEffect(()=>{if(logged)api.get('/employees').then(r=>setEmployees(r.data)).catch(()=>{})},[logged]);
 const login=(e:any)=>{e.preventDefault();const d=new FormData(e.target);if(d.get('username')==='admin'&&d.get('password')==='Admin@123')setLogged(true);else alert('Invalid credentials');};
 const save=async(e:any)=>{e.prevent();await api.post('/employees',form);const r=await api.get('/employees');setEmployees(r.data);setShow(false)};
 if(!logged)return <div className="login"><div className="login-card"><div className="login-logo"><Shield size={24}/></div><h1>EnterpriseFlow HRMS</h1><p>Sign in to your employee workspace</p><form onSubmit={login}><label>Username<input data-testid="login-username" name="username" defaultValue="admin"/></label><label>Password<input data-testid="login-password" name="password" type="password" defaultValue="Admin@123"/></label><button data-testid="login-submit">Sign in</button></form><small>Demo: admin / Admin@123</small></div></div>;
 const filtered=employees.filter(e=>`${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="hr-shell"><aside className="hr-sidebar"><div className="hr-brand"><div><Shield size={18}/></div><strong>PeopleOps</strong></div>{nav.map(([n,I])=>{const Icon=I as any;return <button key={n} className={page===n?'active':''} onClick={()=>setPage(n)}><Icon size={17}/>{n}</button>})}<button className="logout" onClick={()=>setLogged(false)}><LogOut size={17}/>Sign out</button></aside><main><header><div><p>HR WORKSPACE</p><h1>{page}</h1></div><div className="hr-user">PS</div></header><section>{page==='Employees'&&<><div className="toolbar"><div className="hr-search"><Search size={16}/><input data-testid="employee-search" placeholder="Search employees..." value={search} onChange={e=>setSearch(e.target.value)}/></div><button data-testid="add-employee" onClick={()=>setShow(true)}><Plus size={16}/>Add employee</button></div><div className="employee-table"><table><thead><tr><th>Employee</th><th>ID</th><th>Department</th><th>Job title</th><th>Status</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td><div className="person"><b>{e.firstName?.[0]}{e.lastName?.[0]}</b><span>{e.firstName} {e.lastName}<small>{e.email}</small></span></div></td><td>{e.employeeId}</td><td>{e.department}</td><td>{e.jobTitle}</td><td><span className="active-status">{e.status}</span></td></tr>)}</tbody></table></div></>} {page!=='Employees'&&<div className="hr-empty"><BriefcaseIcon/><h3>{page}</h3><p>Connected module ready for workflow actions.</p></div>}</section></main>{show&&<div className="modal-backdrop"><form className="modal" onSubmit={save}><h2>Add employee</h2><div className="modal-grid">{Object.entries({employeeId:'Employee ID',firstName:'First name',lastName:'Last name',email:'Email',phone:'Phone',department:'Department',jobTitle:'Job title'}).map(([k,label])=><label key={k}>{label}<input required value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div><div className="modal-actions"><button type="button" onClick={()=>setShow(false)}>Cancel</button><button data-testid="save-employee">Save employee</button></div></form></div>}</div>
}
function BriefcaseIcon(){return <BriefcaseBusiness size={28}/>}
export default App;
