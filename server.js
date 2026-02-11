/*
====================================================
KART TIMER SERVER (PRODUCTION READY)
----------------------------------------------------
What this server does:
1. Connects to SMS Timing WebSocket
2. Listens for live race data
3. Stores latest race message
4. Calculates remaining session time using ClockMs
5. Exposes data at /session.json
6. Serves your public HTML page
====================================================
*/

// ---------------------------
// IMPORT REQUIRED PACKAGES
// ---------------------------
const express = require("express");      // Web server framework
const WebSocket = require("ws");         // WebSocket client for SMS Timing
const path = require("path");            // Helps with file paths

// ---------------------------
// CREATE EXPRESS APP
// ---------------------------
const app = express();

// ---------------------------
// CONFIGURATION
// ---------------------------
// Cloud hosting requires using process.env.PORT
const PORT = process.env.PORT || 3000;

// SMS Timing WebSocket server
const SMS_HOST = "wss://webserver4.sms-timing.com:10015";

// ---------------------------
// STATE VARIABLES
// ---------------------------
let connected = false;          // Tracks WebSocket connection
let lastRaceMessage = null;     // Stores last full race message
let remainingSeconds = 0;       // Tracks remaining session time
let sessionStatus = "UNKNOWN";  // Tracks race session status

// ---------------------------
// FUNCTION: CONNECT TO SMS TIMING
// ---------------------------
function connectToSms() {
    console.log("Connecting to SMS Timing...");

    // Create WebSocket connection
    const ws = new WebSocket(SMS_HOST);

    // ---------------------------
    // ON OPEN
    // ---------------------------
    ws.on("open", () => {
        console.log("Connected to SMS Timing");
        connected = true;

        // Subscribe to race data
        ws.send(JSON.stringify({
            "$type": "BcStart",
            "ClientKey": "teamsportmanchestertraffordpark",
            "ResourceId": "19476",
            "Timing": true,
            "Notifications": true,
            "Security": "THIRD PARTY TV"
        }));
    });

    // ---------------------------
    // ON MESSAGE
    // ---------------------------
    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            // Only process race updates
            if (data.$type === "BcRace") {
                lastRaceMessage = data;
                sessionStatus = data.RaceState || "UNKNOWN";

                // Use ClockMs from SMS Timing if available (more accurate than calculating from ScheduledEnd)
                if (data.ClockMs != null) {
                    remainingSeconds = Math.floor(data.ClockMs / 1000);
                } else {
                    // Fallback to calculating from ScheduledEnd if ClockMs missing
                    const now = new Date();
                    const endTime = new Date(data.ScheduledEnd);
                    remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
                }
            }

        } catch (err) {
            console.log("Error parsing message:", err.message);
        }
    });

    // ---------------------------
    // ON CLOSE
    // ---------------------------
    ws.on("close", () => {
        console.log("Disconnected from SMS. Reconnecting in 5s...");
        connected = false;

        // Reconnect after 5 seconds
        setTimeout(connectToSms, 5000);
    });

    // ---------------------------
    // ON ERROR
    // ---------------------------
    ws.on("error", (err) => {
        console.log("WebSocket error:", err.message);
        ws.close();
    });
}

// Start WebSocket connection
connectToSms();

// ---------------------------
// API ENDPOINT
// ---------------------------
// Your webpage fetches this
app.get("/session.json", (req, res) => {
    res.json({
        connected,
        remainingSeconds,
        sessionStatus,
        lastRaceMessage
    });
});

// ---------------------------
// SERVE STATIC FILES
// ---------------------------
// Serves files inside "public" folder
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// START SERVER
// ---------------------------
app.listen(PORT, () => {
    console.log("==================================");
    console.log(`Kart Timer Server Running`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log("==================================");
});
