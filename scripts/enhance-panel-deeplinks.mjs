import fs from 'node:fs/promises';

const attendancePath = 'deploy/painel/atendimento/index.html';
let attendance = await fs.readFile(attendancePath, 'utf8');
if (!attendance.includes('CS-PANEL-DEEPLINK')) {
  const target = "leads=d.leads||[];renderList()";
  const replacement = "leads=d.leads||[];renderList();const requestedLead=new URLSearchParams(location.search).get('lead');if(requestedLead)selectLead(requestedLead)/*CS-PANEL-DEEPLINK*/";
  if (!attendance.includes(target)) throw new Error('Attendance deep-link injection point not found');
  attendance = attendance.replace(target, replacement);
  await fs.writeFile(attendancePath, attendance);
  console.log('Attendance lead deep-link enabled');
}

const prospectingPath = 'deploy/painel/prospeccao/index.html';
let prospecting = await fs.readFile(prospectingPath, 'utf8');
const scriptPos = prospecting.indexOf('<script>');
if (scriptPos < 0) throw new Error('Prospecting script block not found');

const head = prospecting.slice(0, scriptPos);
let script = prospecting.slice(scriptPos);
const oldCrmLink = '<a href="/painel/crm/">CRM</a>';
const newAttendanceLink = '<a href="/painel/atendimento/?lead=${encodeURIComponent(l.id)}">Atender</a>';

if (!script.includes(newAttendanceLink)) {
  if (!script.includes(oldCrmLink)) throw new Error('Prospecting row CRM action not found');
  script = script.replace(oldCrmLink, newAttendanceLink);
  prospecting = head + script;
  await fs.writeFile(prospectingPath, prospecting);
  console.log('Prospecting lead row now opens guided attendance');
}
