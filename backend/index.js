const express = require("express");
const cors = require("cors");
const ecrRoutes = require("./routes/ecr");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/ecr", ecrRoutes);

const PORT = 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
