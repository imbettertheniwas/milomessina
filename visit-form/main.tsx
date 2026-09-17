import { createRoot } from "react-dom/client";
import Home from "./app/page";
import "./app/globals.css";
declare global { interface Window { FOMO_VISIT_CONFIG?: {submissionUrl?: string}; } }
const root=document.getElementById("root");
if(!root)throw new Error("Portal root is missing");
const assetBase="/hqvisitform";
const configured=window.FOMO_VISIT_CONFIG?.submissionUrl?.trim() || "";
let submissionUrl="";
if(configured){
  try {
    const parsed=new URL(configured,document.baseURI);
    if(parsed.protocol==="https:" || (parsed.protocol==="http:" && ["localhost","127.0.0.1"].includes(parsed.hostname)))submissionUrl=parsed.href;
  } catch { /* Keep malformed configuration disconnected. */ }
}
createRoot(root).render(<Home assetBase={assetBase} submissionUrl={submissionUrl}/>);
