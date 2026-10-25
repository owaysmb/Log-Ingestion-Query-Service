import "dotenv/config";
import express from "express";
import { Request,Response } from "express";
import { prisma } from "./lib/prisma.js";
import { validateLogBatch } from "./validations/validate.js";
import { parseAggregateFilters, parseLogFilters } from "./validations/queryFilters.js";

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

      const body = req.body;

      if(!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.logs)){
        return res.status(400).json({error:"Request body must be an object with a 'logs' array"})
      }

      const result = await validateLogBatch(body.logs);

      if(result.accepted === 0){
        return res.status(400).json({error:"All log entries are invalid", rejected:result.rejected})
      }

      return res.status(200).json(result);

    } catch (err) {
      console.log(err);
      return res.status(500).json({error:"Error posting logs"});
    }
});


export const GetLogs = app.get("/logs",async(req:Request,res:Response)=>{

    try {

      const parsed = parseLogFilters(req.query);

      if(!parsed.ok){
        return res.status(400).json({error:parsed.error.join("; ")});
      }

      const {service,level,since,until,q,attrs,limit,cursor} = parsed.value;

      if(since && until && until.getTime() < since.getTime()){
        return res.status(400).json({error:"until must be after since"});
      }
      const logs = await prisma.log.findMany({
        take: limit+1,
        ...(cursor !== undefined ? {cursor: { id : cursor }, skip : 1 } : {}),
        where:{
          AND:[
            service && {service},
            since && {timestamp: {gte:since}} ,
            until && {timestamp: {lt:until}},
            level && { level },
            ...attrs.map(([key,value]:[string,string])=>(
                { attributes: { path: [key], equals: value } }
            )) ,
            q && { message: { contains: q, mode: "insensitive" } },
          ].filter(Boolean) as any[]
        },
        orderBy: [{ timestamp: "desc"} , {id:"desc"}]
      })

      const rest = logs.length > limit ;
      const page = rest ? logs.slice(0,limit) : logs ;
      const next_cursor = rest ? page[page.length-1].id.toString() : null;

      res.json({logs : page.map((l) => ({...l , id: l.id.toString()  })) , next_cursor})


    } catch (err) {
      console.log(err);
      res.status(500).json({error:"Error Getting Logs"});
    }

});


export const GetAggregateLogs = app.get("/logs/aggregate", async(req:Request,res:Response) =>{

  try {
    
    const aggregateParsed = parseAggregateFilters(req.query);

    if(!aggregateParsed.ok){
      return res.status(400).json({error:aggregateParsed.error.join("; ")});
    }

    const {service,level,since,until,q,attrs,bucket,groupBy} = aggregateParsed.value;

    if(since && until && until.getTime() < since.getTime()){
      return res.status(400).json({error:"until must be after since"});
    }

 
    const rows = await prisma.log.findMany({
      where:{
        timestamp:{gte:since,lt:until},
        AND:[
          service && {service},
          level && { level },
          ...attrs.map(([key,value]:[string,string])=>(
              { attributes: { path: [key], equals: value } }
          )) ,
          q && { message: { contains: q, mode: "insensitive" } },
        ].filter(Boolean) as any[]
      },
      select:{timestamp:true,...(groupBy ?{[groupBy]:true} :{})}
    });


    const bucketMs:Record<string, number> = {"1m":(60 * 1000) , "5m":(5*60*1000) , "1h" : (60*60*1000) , "1d" : (24*60*60*1000)};
    const base = since.getTime();
    const counts = new Map<string, {start: Date; group: string | null; count: number}>();

    for (const row of rows) {
      const start = new Date(base + Math.floor((row.timestamp.getTime() - base)/bucketMs[bucket]) * bucketMs[bucket]);
      const group = groupBy ? (row as any)[groupBy] : null;
      const key = start.toISOString() + "|" + group;
      const e = counts.get(key) ?? {start , group,count:0};
      e.count++;
      counts.set(key, e);
    }

    const buckets = [...counts.values()].sort(
      (a, b) => a.start.getTime() - b.start.getTime() || String(a.group).localeCompare(String(b.group))
    );

    res.json({ buckets });


  } catch (err) {
    res.status(500).json({error:"Error Getting Aggregate Logs"})
    console.log(err);
  }

}); 



const PORT = Number(process.env.PORT ?? 8080);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
