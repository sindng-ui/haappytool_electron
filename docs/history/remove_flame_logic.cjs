const fs = require("fs");
const path = "components/LogViewer/PerfDashboard.tsx";
let lines = fs.readFileSync(path, "utf8").split("\n");

if (lines[567].includes("Canvas Drawing Logic")) {
    lines.splice(567, 342);
    fs.writeFileSync(path, lines.join("\n"));
    console.log("Spliced exactly 342 lines cleanly.");
} else {
    console.log("Safety check failed. Line 567 is:", lines[567]);
}
