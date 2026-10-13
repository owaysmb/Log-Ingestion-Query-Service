import "dotenv/config";
import express from "express";
import { Request,Response } from "express";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(express.json());

export const GetHealth = app.get("/health" , async (req:Request,res:Response) =>{

      try {
        
        res.status(200).json("get health has been executed correctly");

      } catch (err) {
        res.status(500).json("ERROR Getting Health");
      }

});

export const PostLogs = app.post("/logs", async (req:Request,res:Response)=>{
    try {

      const {logs} = req.body;
      let acceptedResponses: any[] = [];
      let rejectedResponses: any[] = [];
      let LogsIndex = 0;
      const allowedLevel = new Set(["error" , "debug" , "info" , "warn"]);
      
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

        return res.status(200).json({
          accepted:acceptedResponses.length,
          rejected:rejectedResponses
        });

      }else{
        res.status(400).json({error:"All Entries are invalid"})
      }
    } catch (err) {
      res.status(500).json("error posting logs");
      console.log(err);
    }
});


export const GetLogs = app.get("/logs",async(req:Request,res:Response)=>{

    try {
      
      const {service,level,since,until,attr,q,limit,cursor} = req.query;
      const take = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit) , 1000) : 100;
      const [key, value] = String(attr).split(".");

      const logs = await prisma.log.findMany({
        take: take+1,
        ...(cursor ? {cursor: { id : BigInt(String(cursor)) }, skip : 1 } : {}),
        where:{
          AND:[

            service && {service: String(service) },
            since && {timestamp: {gte:new Date(String(since))}} ,
            until && {timestamp: {lte:new Date(String(until))}},
            level !== undefined && { level: String(level) },
            attr && { attributes: { path: key, string_contains: value } },
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
