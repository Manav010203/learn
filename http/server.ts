import express from "express";
const app = express();
const port = 3000;
app.get("/",(Req,res)=>{
    res.send("Helloe World!");
})

app.listen(port,()=>{
    console.log(`Listening on the port ${port}`);
})