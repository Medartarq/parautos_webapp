import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
export type ReceptionDraftInput={revision?:number;currentStep:number;payload:unknown};
export interface ReceptionDraftRepository { find(userId:number):Promise<any|undefined>; save(userId:number,input:ReceptionDraftInput):Promise<void>; delete(userId:number):Promise<void>; }
export const mariaDbReceptionDraftRepository:ReceptionDraftRepository={
 async find(userId){return (await getPool().query<any[]>("SELECT revision, current_step AS currentStep, payload, updated_at AS updatedAt FROM reception_drafts WHERE user_id = ?",[userId]))[0];},
 async save(userId,input){const connection=await getPool().getConnection();let failed=true;try{await connection.beginTransaction();const current=(await connection.query<any[]>("SELECT revision FROM reception_drafts WHERE user_id = ? FOR UPDATE",[userId]))[0];if(!current){if(input.revision!==undefined)throw new AppError(409,"RECEPTION_DRAFT_CONFLICT","El borrador de recepción ya no está disponible. Recárguelo antes de guardar.");await connection.query("INSERT INTO reception_drafts (user_id, revision, current_step, payload) VALUES (?, 1, ?, ?)",[userId,input.currentStep,JSON.stringify(input.payload)]);}else{if(input.revision!==Number(current.revision))throw new AppError(409,"RECEPTION_DRAFT_CONFLICT","El borrador fue actualizado desde otro dispositivo. Recárguelo antes de guardar.");await connection.query("UPDATE reception_drafts SET revision = revision + 1, current_step = ?, payload = ? WHERE user_id = ?",[input.currentStep,JSON.stringify(input.payload),userId]);}await connection.commit();failed=false;}finally{try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); }}},
 delete:(userId)=>getPool().query("DELETE FROM reception_drafts WHERE user_id = ?",[userId]).then(()=>undefined)
};
