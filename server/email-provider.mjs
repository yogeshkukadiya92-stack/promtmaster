const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export function createEmailProvider() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;
  if (!apiKey || !from) return null;
  return {
    name: "resend",
    async sendInvitation({ to, workspaceName, inviteUrl, expiresAt }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `You’re invited to ${workspaceName}`,
          html: `<h1>Join ${escapeHtml(workspaceName)}</h1><p>You have been invited to collaborate in IntentOS.</p><p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p><p>This secure link expires ${escapeHtml(new Date(expiresAt).toUTCString())}.</p>`,
          text: `Join ${workspaceName}\n\nAccept invitation: ${inviteUrl}\n\nThis secure link expires ${new Date(expiresAt).toUTCString()}.`,
        }),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
      const payload = await response.json();
      return { id: payload.id };
    },
    async sendLifecycle({to,subject,headline,body,actionUrl,actionLabel}) {
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({from,to:[to],subject,html:`<h1>${escapeHtml(headline)}</h1><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(actionUrl)}">${escapeHtml(actionLabel)}</a></p><p>You are receiving this product guidance from IntentOS.</p>`,text:`${headline}\n\n${body}\n\n${actionLabel}: ${actionUrl}`})});
      if(!response.ok)throw new Error(`Email provider returned ${response.status}.`);const payload=await response.json();return{id:payload.id};
    },
  };
}
