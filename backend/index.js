const express = require("express");
const cors = require("cors");
const ecrRoutes = require("./routes/ecr");

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use("/api/ecr", ecrRoutes);

const PORT = 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
