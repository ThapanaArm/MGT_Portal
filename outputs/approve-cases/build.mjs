import fs from 'node:fs/promises';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
const out = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const text = await fs.readFile(new URL('../../docs/approve-test-cases.md',import.meta.url),'utf8');
const records=text.split('\n').filter(l=>/^\| APR-\d{3} \|/.test(l)).map(l=>l.split('|').slice(1,-1).map(v=>v.trim()));
const core=new Set([1,2,3,4,5,8,9,10,12,15,18,20,22,32,33].map(n=>`APR-${String(n).padStart(3,'0')}`));
const wb=Workbook.create();
for(const [name, rows, note] of [
 ['กรณีหลัก',records.filter(r=>core.has(r[0])),'เริ่มจาก 15 กรณีนี้: เส้นทางอนุมัติ สิทธิ์ การแก้ไข และผลหลังอนุมัติ'],
 ['กรณีเสริม',records.filter(r=>!core.has(r[0])),'อีก 23 กรณี: เลือกทดสอบเมื่อแก้ฟังก์ชันที่เกี่ยวข้อง หรือก่อนทดสอบระบบเต็มรอบ']
]){
 const s=wb.worksheets.add(name);s.showGridLines=false;
 s.getRange('A2').values=[[`Test Case การ Approve — ${name}`]];
 s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#183153'};
 s.getRange('A3').values=[[note]];
 s.getRange('A4').values=[['R1–R3 = กรรมการที่ได้รับมอบหมาย | IT = Admin | ผลทดสอบยังเป็น Not Run ทุกกรณี']];
 const head=['Test Case ID','ความสำคัญ','เรื่อง / เงื่อนไขก่อนทดสอบ','ขั้นตอนทดสอบ','ผลที่คาดหวัง','ผลจริง','สถานะ','ผู้ทดสอบ','วันที่ทดสอบ','Defect / หมายเหตุ'];
 s.getRange('A6:J6').values=[head];
 const data=rows.map(r=>[...r,'','Not Run','','','']);
 const end=6+data.length;
 s.getRange(`A7:J${end}`).values=data;
 s.getRange(`A3:J${end}`).format.font={name:'Arial',size:11};
 s.getRange('A6:J6').format={fill:'#183153',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:32,wrapText:true};
 s.getRange(`A7:J${end}`).format.wrapText=true;
 s.getRange(`A7:J${end}`).format.verticalAlignment='top';
 s.getRange(`A7:J${end}`).format.rowHeight=112;
 for(const [col,width] of [['A',15],['B',12],['C',45],['D',53],['E',65],['F',35],['G',15],['H',20],['I',18],['J',30]]) s.getRange(`${col}6:${col}${end}`).format.columnWidth=width;
 for(let r=7;r<=end;r++)if(r%2===1)s.getRange(`A${r}:E${r}`).format.fill='#F0F4F8';
 s.getRange(`F7:J${end}`).format.fill='#FFF8E5';
 s.getRange(`G7:G${end}`).dataValidation={rule:{type:'list',values:['Not Run','Pass','Fail','Blocked','N/A']}};
 s.getRange(`I7:I${end}`).setNumberFormat('dd/mm/yyyy');
 s.getRange(`G7:G${end}`).conditionalFormats.add('containsText',{text:'Fail',format:{fill:'#FDE9E7',font:{color:'#B42318'}}});
 s.getRange(`G7:G${end}`).conditionalFormats.add('containsText',{text:'Pass',format:{fill:'#E8F3EC',font:{color:'#187647'}}});
 s.freezePanes.freezeRows(6);
 s.freezePanes.freezeColumns(1);
 s.getRange(`A${end+2}`).values=[['อ้างอิง: docs/application-request-flow.md และ ApplicationWorkflow.cs / ApplicationsController.cs / DevelopmentRequestsController.cs']];
 s.getRange(`A${end+3}`).values=[['เตรียมบัญชี Owner, IT, R1–R4 และ User X; ใช้คำขอใหม่หรือคืนสถานะตามเงื่อนไขก่อนทดสอบของแต่ละกรณี']];
}
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'กรณีหลัก!A6:G8',tableMaxCols:7,tableMaxRows:3,maxChars:1600})).ndjson);
await (await SpreadsheetFile.exportXlsx(wb)).save(`${out}/Approve_Test_Cases.xlsx`);
for(const name of ['กรณีหลัก','กรณีเสริม']){
 const p=await wb.render({sheetName:name,range:'A6:E9',scale:1,format:'png'});
 await fs.writeFile(`${out}/${name}.png`,new Uint8Array(await p.arrayBuffer()));
}
console.log(JSON.stringify({core:core.size,supplement:records.length-core.size,total:records.length}));
