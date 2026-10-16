import "dotenv/config";
import express from "express";
import { Request,Response } from "express";
import { prisma } from "../lib/prisma.js";

// let invalidResponses = {
//     index:Number,
//     reason:String
// }


const allowedLevel = new Set(["error" , "debug" , "info" , "warn"]);


export async function validateLogBatch(logs :any){

    let LogsIndex = 0;

        const acceptedResponses = []
        const rejectedResponses = []
    
          
    for(const log of logs) {

        LogsIndex++; 
        let rejected = false;

        const {timestamp,level,service,message,attributes} = log;

        if(typeof timestamp !== "string" || isNaN(new Date(timestamp).getTime()))  
            {rejectedResponses.push({index:LogsIndex , reason:"invalid timestamp"});rejected = true;}

        if(!allowedLevel.has(level))      
            {rejectedResponses.push({index:LogsIndex , reason:"invalid level"});    rejected = true;}
        
        if( typeof service !== "string" || !service.trim().length )               
            {rejectedResponses.push({index:LogsIndex , reason:"invalid service"});  rejected = true;}

        if( typeof message !== "string" || !message.trim().length )               
            {rejectedResponses.push({index:LogsIndex , reason:"invalid message"});  rejected = true;}
        
        let rejectAttribute = false;

        if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
            rejectAttribute = true;
        } else {
            for (const [key, value] of Object.entries(attributes)) {
                const t = typeof value;
                if (t !== "string" && t !== "number" && t !== "boolean") {
                    rejectAttribute = true;
                }
            }
        }

        if(!rejected) {
            acceptedResponses.push(log);
            await prisma.log.create({
                data:{
                    timestamp : new Date(timestamp),
                    level,
                    service,
                    message,
                    attributes: (rejectAttribute ? {} : attributes)
                }
            })
        }

    }


    if(acceptedResponses.length > 0){

        return {
          accepted:acceptedResponses.length,
          rejected:rejectedResponses
        };

      }else{
        return {error:"All Entries are invalid"}
      }


}