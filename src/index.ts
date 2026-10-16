import "dotenv/config";
import express from "express";
import { Request,Response } from "express";
import { prisma } from "./lib/prisma.js";
import { validateLogBatch } from "./vlaidations/validate.js";


const app = express();

app.use(express.json());

export const GetHealth = app.get("/health" , async (req:Request,res:Response) =>{

      try {
        
        res.status(200).json("get health has been executed correctly");

      } catch (err) {
        res.status(500).json("ERROR Getting Health");
      }

});

const allowedLevel = new Set(["error" , "debug" , "info" , "warn"]);

export const PostLogs = app.post("/logs", async (req:Request,res:Response)=>{
    try {

      if(!Array.isArray(req.body?.logs)) return res.status(400).json({error:"Logs array is not arrays"})

      const result = await validateLogBatch(req.body?.logs);
      res.status(200).json(result);


    } catch (err) {
      res.status(500).json("error posting logs");
      console.log(err);
    }
});


export const GetLogs = app.get("/logs",async(req:Request,res:Response)=>{

    try {
      
      const {service,level,since,until,q,limit,cursor} = req.query;
      let invalidInput = false;
      let errorDescription = [];

      const attrEntries = Object.entries(req.query).filter(([k]) => k.startsWith("attr.")).map(([key,v]) => [key.slice("attr.".length  ) ,String(v)] as const)

      if(service && (!Number.isNaN(Number(service)) || !String(service).trim().length) )       {invalidInput = true; errorDescription.push("Invalid Service input")}
      if(level && !allowedLevel.has(String(level)))                              {invalidInput = true; errorDescription.push("invalid level input")}


      if( since && (isNaN(new Date(String(since)).getTime())) || (until && (isNaN(new Date(String(until)).getTime()))) ) {

          invalidInput = true;
          errorDescription.push("invalid since/until input")
      
      }else if( since && until && (new Date(String(until)).getTime()) < (new Date(String(since)).getTime())) {
            invalidInput = true;
            errorDescription.push("until Date before since")
      }

      if( limit && (isNaN(Number(limit)) || Number(limit) > 1000))  
        {invalidInput = true; errorDescription.push("Invalid limit input , limit is NAN or limit larger than 1000" )}

      if(cursor && !/^\d+$/.test(String(cursor)) ) {invalidInput = true; errorDescription.push("Invalid cursor input")}

      if( attrEntries.some(([k,v]) => !k.length || v === "" )) {invalidInput = true; errorDescription.push("Invalid attr input")}

      if(invalidInput){
        return res.status(400).json({error:errorDescription});
      }

      const take = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit) , 1000) : 100;
      const logs = await prisma.log.findMany({
        take: take+1,
        ...(cursor ? {cursor: { id : BigInt(String(cursor)) }, skip : 1 } : {}),
        where:{
          AND:[

            service && {service: String(service) },
            since && {timestamp: {gte:new Date(String(since))}} ,
            until && {timestamp: {lte:new Date(String(until))}},
            level !== undefined && { level: String(level) },
            ...attrEntries.map(([key,value])=>(
                { attributes: { path: [key], equals: value } }
            )) ,
            q && { message: { contains: String(q) } },   
  


          ].filter(Boolean) as any[]
        },
        orderBy: [{ timestamp: "desc"} , {id:"desc"}]
      })

      const rest = logs.length > take ;
      const page = rest ? logs.slice(0,take) : logs ;
      const next_cursor = rest ? page[page.length-1].id.toString() : null;

      res.json({logs : page.map((l) => ({...l , id: l.id.toString()  })) , next_cursor})


    } catch (err) {
      res.status(500).json("Error Getting Logs");
      console.log(err);
    }

});



const PORT = Number(process.env.PORT ?? 8080);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
