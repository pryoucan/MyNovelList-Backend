import "./bootstrap.js";

import dbConnectivity from "./config/db.config.js";

import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth.route.js";
import { novelRouter } from "./routes/novel.route.js";
import { userNovelRouter } from "./routes/user-novel.route.js";

const app = express();

app.disable("etag");

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isLocal = /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
                    /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) ||
                    /^https?:\/\/\[::1\](:\d+)?$/i.test(origin) ||
                    /\.local(:\d+)?$/i.test(origin) ||
                    /^https?:\/\/(10|192\.168|172\.(1[6-9]|2[0-9]|3[0-1])|169\.254)\./i.test(origin);
                    
    if (isLocal || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/novels", novelRouter);
app.use("/api/users/novels", userNovelRouter);

const runServer = async () => {
    try {
        await dbConnectivity();
        app.listen(PORT, () => {
            console.log(`server is running on port ${PORT}`);
        });
    }
    catch(error) {
        console.log(error);
        process.exit(1);
    }
};

runServer();