"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Globe2, MapPin, Users, ArrowRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateKey, nyToday, requestTimes, formatRequestTime, timeInputValue, validateRequest } from "@/lib/visits";

export default function Home({ assetBase = "", submissionUrl = "" }: { assetBase?: string; submissionUrl?: string }) {
  const [today, setToday] = useState<Date>();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [specificOpen, setSpecificOpen] = useState(false);
  const [specificTime, setSpecificTime] = useState("10:30");
  const isSpecificTime = !!time && !requestTimes.includes(time);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [details, setDetails] = useState({name:"",email:"",social:"",notes:"",website:""});
  const requestId = useRef("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setToday(nyToday()); requestId.current=crypto.randomUUID(); }, []);
  useEffect(() => { if(step > 1) heading.current?.focus(); }, [step]);
  const maxDate=today ? new Date(today.getFullYear(),today.getMonth(),today.getDate()+90) : undefined;
  const dateLabel=date?.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if(!date || !time || busy)return;
    if(!submissionUrl){setError("This form is not connected yet. Please contact the fomo team.");return;}
    const payload={...details,date:dateKey(date),time,requestId:requestId.current};
    const invalid=validateRequest(payload);
    if(invalid){setError(invalid);return;}
    setBusy(true);setError("");
    try {
      const response=await fetch(submissionUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json() as {error?:string;reference?:string;status?:string};
      if(!response.ok)throw new Error(data.error||"Your request couldn’t be saved. Please try again.");
      if(data.reference!==requestId.current || data.status!=="pending")throw new Error("We could not verify your request was saved. Please try again or contact the team.");
      setReceipt(data.reference);setStep(3);
    } catch(e) {setError(e instanceof Error?e.message:"Something went wrong. Please try again.");}
    finally {setBusy(false);}
  }
  return (
    <div className="site-shell">
      <header className="site-header">
        <a href={assetBase || "/"} className="brand" aria-label="fomo HQ home"><img src={assetBase+"/wordmark.svg"} alt="fomo" width="97" height="33"/><span>/hq</span></a>
        <span className="city"><MapPin size={15}/>New York City</span>
      </header>
      <main>
        <section className="invitation" aria-labelledby="invite-title">
          <span className="eyebrow">YOU’RE INVITED</span>
          <h1 id="invite-title">Visit<br/><span>fomo HQ.</span></h1>
          <p className="benefits">Meet the fomo and go-to-market team, get a closer look at what we’re building, and explore content or collaborations that fit your audience.</p>
          <div className="visit-info">
            <div><MapPin size={19}/><span>New York City<small>Office address shared once confirmed.</small></span></div>
            <div><Users size={19}/><span>In person with the team<small>Bring your ideas and questions.</small></span></div>
          </div>
          <p className="invitation-note">Pick a time that works for you.<br/>We’ll confirm the visit together.</p>
        </section>
        <section className="booking" aria-label="Request a visit to fomo HQ">
          <div className="booking-body">
          {step!==3 && <><h2 tabIndex={-1} ref={heading}>{step===1 ? "Pick a date & time" : "Your details"}</h2><p className="booking-subtitle">{step===1?"Choose a preferred time. We’ll confirm availability.":"Let us know how to reach you."}</p><div className="steps" aria-label={`Step ${step} of 2`}><span className={step===1?"active":"complete"}><i>{step===1?"1":<Check size={12}/>}</i>Date & time</span><span className="step-line"/><span className={step===2?"active":""}><i>2</i>Your details</span></div></>}
          {step===1 && <>
            <div className="calendar-layout"><div className="calendar-wrap">{today ? <Calendar mode="single" selected={date} onSelect={setDate} defaultMonth={today} startMonth={today} endMonth={maxDate} disabled={[{before:new Date(today.getFullYear(),today.getMonth(),today.getDate()+1)},{after:maxDate!}]} showOutsideDays={false} className="visit-calendar"/>:<div className="calendar-loading">Loading calendar…</div>}</div>
              <div className="times"><h3>{date?date.toLocaleDateString("en-US",{month:"short",day:"numeric"}):"Preferred time"}</h3><Popover open={specificOpen} onOpenChange={open=>{setSpecificOpen(open);if(open)setSpecificTime(timeInputValue(time)||"10:30");}}>
                <PopoverTrigger asChild><Button variant="link" className={"specific-time-trigger time-caption"+(isSpecificTime?" has-selection":"")} disabled={!date} aria-label={isSpecificTime?"Preferred time "+time+". Change specific time":"Choose a specific start time"}>{!date?"Select a date first":isSpecificTime?time+" · Edit":"Specific time"}</Button></PopoverTrigger>
                <PopoverContent className="specific-time-popover" align="end" sideOffset={8} collisionPadding={16} aria-labelledby="specific-time-title" aria-describedby="specific-time-note">
                  <form onSubmit={event=>{event.preventDefault();const value=formatRequestTime(specificTime);if(value){setTime(value);setSpecificOpen(false);}}}>
                    <h3 id="specific-time-title">Choose a specific time</h3>
                    <p id="specific-time-note">New York time. We’ll confirm availability.</p>
                    <label htmlFor="specific-time">Preferred start time<Input id="specific-time" type="time" step={60} required value={specificTime} onChange={event=>setSpecificTime(event.target.value)}/></label>
                    <Button type="submit" className="primary-action" disabled={!formatRequestTime(specificTime)}>Use this time</Button>
                  </form>
                </PopoverContent>
              </Popover><RadioGroup className="time-options" value={time} onValueChange={setTime} aria-label="Preferred start time" disabled={!date}>{requestTimes.map(t=><label className={`time-option ${time===t?"selected":""} ${!date?"unavailable":""}`} key={t}><RadioGroupItem value={t} id={`time-${t}`} /><span>{t}</span></label>)}</RadioGroup></div>
            </div>
            <div className="timezone"><Globe2 size={15}/><span>All times are in New York time.</span></div>
            <Button className="primary-action" disabled={!date||!time} onClick={()=>setStep(2)}>Continue<ArrowRight size={18}/></Button>
            <p className="under-button">Your visit is confirmed after the team gets in touch.</p>
          </>}
          {step===2 && <>
            <div className="selection-summary"><div><Clock3 size={18}/><span><strong>{dateLabel}</strong><span>{time} · New York time · Pending confirmation</span></span></div><Button variant="ghost" onClick={()=>setStep(1)} className="edit-button" aria-label="Change preferred date and time">Edit</Button></div>
            <form onSubmit={submit}>
              <div className="form-pair"><label htmlFor="name">Your name<Input id="name" name="name" autoComplete="name" placeholder="First and last name" required maxLength={100} value={details.name} onChange={e=>setDetails({...details,name:e.target.value})}/></label><label htmlFor="email">Email address<Input id="email" name="email" autoComplete="email" type="email" placeholder="you@example.com" required maxLength={254} value={details.email} onChange={e=>setDetails({...details,email:e.target.value})}/></label></div>
              <label htmlFor="social">Social profile <span>Optional</span><Input id="social" name="social" placeholder="Your social handle or profile link" maxLength={300} value={details.social} onChange={e=>setDetails({...details,social:e.target.value})}/></label>
              <label htmlFor="notes">What would you like to chat about? <span>Optional</span><Textarea id="notes" name="notes" placeholder="A collaboration idea, your community, or just saying hello…" maxLength={1500} rows={3} value={details.notes} onChange={e=>setDetails({...details,notes:e.target.value})}/></label>
              <div className="honey" aria-hidden="true"><label htmlFor="website">Leave this empty<Input id="website" tabIndex={-1} autoComplete="off" value={details.website} onChange={e=>setDetails({...details,website:e.target.value})}/></label></div>
              <p className="privacy-note">Your details are shared with the fomo team to coordinate your visit.</p>
              {error&&<p className="form-error" role="alert">{error}</p>}
              <Button type="submit" className="primary-action" disabled={busy}>{busy?"Saving your request…":"Request a visit"}{!busy&&<ArrowRight size={18}/>}</Button>
              <p className="under-button">The team will confirm the time and share the office address.</p>
            </form>
            <Button variant="ghost" className="back-button" disabled={busy} onClick={()=>setStep(1)}><ArrowLeft size={15}/>Back to calendar</Button>
          </>}
          {step===3 && <div className="success"><span className="success-icon"><Check size={29}/></span><span className="booking-kicker">REQUEST SAVED</span><h2 ref={heading} tabIndex={-1}>Request received.</h2><p>Thanks, {details.name.split(" ")[0]}. Your preferred visit time is saved for the fomo team to review.</p><div className="receipt"><span>YOUR PREFERRED VISIT</span><strong>{dateLabel}</strong><p>{time} · New York time</p><span className="pending">Pending confirmation</span></div><p className="success-next">Your visit is not booked yet. The team can reach you at <strong>{details.email}</strong> to agree on a time and share arrival details.</p><p className="reference">Request reference · {receipt}</p></div>}
          </div>
        </section>
      </main>
      <footer className="site-footer">fomo HQ · New York City</footer>
    </div>
  );
}
