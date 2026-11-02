import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A generated reference for the baoyu-design design-system checker/editor.
// The app's theme.ts remains the source of truth; rerun after changing it.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(root, 'design-system/agristock/project');
const source = await readFile(path.join(root, 'apps/mobile/src/theme.ts'), 'utf8');
const colors = [...source.matchAll(/^ {4}(\w+): "(#[0-9A-Fa-f]{6})"/gm)].map((m) => ({name: 'color-' + m[1], value:m[2]}));
const scale = (name) => [...source.match(new RegExp(name + ': \\{([^}]+)\\}'))[1].matchAll(/(\w+): (\d+)/g)].map((m) => ({name:name+'-'+m[1], value:m[2]+'px'}));
const fontRecords = JSON.parse(await readFile(path.join(root,'apps/mobile/assets/fonts/ui-sources.json'),'utf8'));
await mkdir(path.join(project,'fonts'), {recursive:true});
await mkdir(path.join(project,'components/Cover'), {recursive:true});
const fonts = [];
for (const record of fontRecords) {
  await copyFile(path.join(root,'apps/mobile/assets/fonts',record.file),path.join(project,'fonts',record.file));
  const [family, weight] = record.file.replace('.ttf','').split('-');
  fonts.push({family, file:'fonts/'+record.file, weight:String({Regular:400,Medium:500,SemiBold:600,Bold:700}[weight]), style:'normal'});
}
const tokens = {
  color:{themes:[{id:'light',name:'Sáng'}],tokens:colors},
  type:{fonts, families:{body:'Inter, sans-serif',heading:'Manrope, sans-serif'},groups:[
    {name:'Nội dung',family:'body',styles:[{name:'body',fontSize:'16px',lineHeight:'24px',fontWeight:400,sample:'Hàng hóa và khách hàng'},{name:'caption',fontSize:'14px',lineHeight:'21px',fontWeight:400,sample:'Tiền thực thu trong kỳ'},{name:'amount',fontSize:'34px',lineHeight:'44px',fontWeight:700,sample:'480.000 ₫'}]},
    {name:'Tiêu đề',family:'heading',styles:[{name:'heading',fontSize:'20px',lineHeight:'28px',fontWeight:700,sample:'Thao tác nhanh'}]},
  ]},spacing:{tokens:scale('space')},radius:{tokens:scale('radius')},
};
await writeFile(path.join(project,'tokens.json'),JSON.stringify(tokens,null,2));
const fontLicenses = await Promise.all(['Inter','Manrope'].map(async (family) => '# '+family+'\n\n'+await readFile(path.join(root,'apps/mobile/assets/licenses',family+'-OFL.txt'),'utf8')));
await writeFile(path.join(project,'font-licenses.md'),fontLicenses.join('\n\n'));
await writeFile(path.join(project,'README.md'),'Dùng color-primary cho thao tác chính và doanh thu, color-primaryDark cho thanh đầu trang. Dùng color-highlight với color-onHighlight cho nút bán tại quầy. Biểu đồ dùng color-chartSeries; mốc được chọn có viền color-text. Trạng thái luôn có nhãn: đang giao dịch dùng color-warningFill, hoàn thành dùng color-successFill. Không dùng chỉ màu để truyền đạt trạng thái.\n\nGiữ Inter cho nội dung/số tiền, Manrope cho tiêu đề. Doanh thu và thực thu là hai chỉ số riêng, không thêm tỷ lệ tăng trưởng khi chưa có dữ liệu. Lối tắt hai cột giữ nhãn đầy đủ, dữ liệu giới hạn theo quyền và kho.\n\nBản tham chiếu được sinh từ theme.ts; không chỉnh để thay đổi app. Component chạy thật nằm trong apps/mobile/src/components và screens.\n');
await writeFile(path.join(project,'components/Cover/preview.html'),'<!-- @dsCard height=288 -->\n<!doctype html><html lang="vi"><meta charset="utf-8"><style>body{margin:0;background:var(--color-canvas);font-family:Inter,sans-serif;color:var(--color-text)}main{display:grid;grid-template-columns:2fr 1fr;gap:12px;padding:24px}section{padding:24px;border-radius:16px;background:var(--color-primary);color:white}h1{font-family:Manrope,sans-serif;font-size:34px;margin:0 0 16px}p{line-height:1.5}.accent{background:var(--color-highlight);color:var(--color-onHighlight)}.bars{display:flex;gap:8px;align-items:end;height:72px}.bars i{display:block;width:24px;background:white;border-radius:4px 4px 0 0}</style><main><section><h1>AgriStock</h1><p>Bán tại quầy. Quản lý rõ ràng.</p><div class="bars"><i style="height:32px"></i><i style="height:48px"></i><i style="height:72px"></i></div></section><section class="accent"><h2>Thao tác nhanh</h2><p>Màu đậm, nhãn rõ.<br>Đủ dấu tiếng Việt.</p></section></main></html>');
// Index last, as required by the repository's file format.
const index={v:3,layout:'files',createdOnFiles:{v:1,at:new Date().toISOString()},title:'AgriStock — Fieldwork',namespace:'AgriStock',libraries:[],sections:{},groups:[],assetGroups:{},blobs:{},docs:{sections:[]}};
await writeFile(path.join(project,'design-system.json'),JSON.stringify(index,null,2));
console.log('Exported AgriStock theme reference to design-system/agristock/project');
