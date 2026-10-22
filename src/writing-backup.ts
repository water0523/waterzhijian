import {readWritingLog,writingDay,writingSaveStatus} from './writing-log';
import {readWritingAchievements,syncWritingAchievements} from './writing-progress';

export function writingBackupData(){
 const log=readWritingLog();syncWritingAchievements(log);
 return {format:'feishui-writing-journal',version:1,exportedAt:new Date().toISOString(),includesPending:writingSaveStatus().state!=='saved',log,achievements:readWritingAchievements()};
}
export function downloadWritingRecords(){
 const url=URL.createObjectURL(new Blob([JSON.stringify(writingBackupData(),null,2)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download='非水成章-写作记录-'+writingDay()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
