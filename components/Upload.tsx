"use client";
import { useState } from "react";
export default function Upload({ draftId, token }: { draftId: string; token: string }) {
  const [msg, setMsg] = useState(""); const [img, setImg] = useState("");
  async function up(f: File) { setMsg("Uploading…"); const fd = new FormData(); fd.append("file", f); const r = await fetch(`/api/upload/${draftId}?t=${encodeURIComponent(token)}`, { method: "POST", body: fd }).then(r => r.json()); if (r.ok) { setImg(r.url); setMsg("Uploaded! Go back to the chat and say \"uploaded\"."); } else setMsg(r.error); }
  return <div className="space-y-3"><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e => e.target.files?.[0] && up(e.target.files[0])} />{img && <img src={img} className="w-32 h-32 rounded-xl" alt="" />}<p className="text-sm">{msg}</p></div>;
}
