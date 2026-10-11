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


const PORT = Number(process.env.PORT ?? 8080);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
