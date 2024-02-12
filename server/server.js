import express, { response } from "express";
import mongoose from "mongoose";
import "dotenv/config";
import cors from "cors";
import admin from "firebase-admin";
import serviceAccountKey from "./blogging-app-e0e54-firebase-adminsdk-42p4f-1fef5cbd71.json" assert { type: "json" };
import routes from "./routes/index.js";

const server = express();

let PORT = 3000;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
});

server.use(express.json());
server.use(cors());

server.use("/", routes);

mongoose.connect(process.env.DB_LOCATION, {
    autoIndex: true,
});

server.listen(PORT, () => {
    console.log("listening on port :" + PORT);
});
