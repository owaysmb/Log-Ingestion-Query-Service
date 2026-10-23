import "dotenv/config";
import express from "express";
import { Request,Response } from "express";
import { prisma } from "./lib/prisma.js";
import { validateLogBatch } from "./validations/validate.js";
import { parseLogFilters } from "./validations/queryFilters.js";

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



const PORT = Number(process.env.PORT ?? 8080);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
