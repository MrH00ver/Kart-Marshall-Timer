/*
====================================================
KART TIMER SERVER (PRODUCTION READY)
----------------------------------------------------
Features:
1. Connects to SMS Timing WebSocket
2. Listens for live race data
3. Calculates remaining session time using ClockMs
4. Exposes data at /session.json
5. Serves static HTML/CSS/JS from public/
6. Auto-reconnect if WebSocket closes
====================================================
*/

const express = require("express");   // Web server framework
const WebSocket = require("ws");      // WebSocket client
const path = require("path");         // File path helper

// ---------------------------
// CONFIGURATION
// ---------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const SMS_HOST = "wss://webserver4.sms-timing.com:10015";

// ---------------------------
// STATE VARIABLES
// ---------------------------
let connected = false;          // WebSocket connection status
let lastRaceMessage = null;     // Stores latest race data
let remainingSeconds = 0;       // Session remaining time
let sessionStatus = "UNKNOWN";  // Session state

// ---------------------------
// FUNCTION: CONNECT TO SMS TIMING
// ---------------------------
function connectToSms() {
    console.log("Connecting to SMS Timing...");

    const ws = new WebSocket(SMS_HOST);

    ws.on("open", () => {
        console.log("Connected to SMS Timing");
        connected = true;

        // Subscribe to race updates
        ws.send(JSON.stringify({
            "$type": "BcStart",
            "ClientKey": "teamsportmanchestertraffordpark",
            "ResourceId": "19476",
            "Timing": true,
            "Notifications": true,
            "Security": "THIRD PARTY TV"
        }));
    });

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            if (data.$type === "BcRace") {
                lastRaceMessage = data;
                sessionStatus = data.RaceState || "UNKNOWN";

                // Use ClockMs for accurate remaining seconds
                if (data.ClockMs != null) {
                    remainingSeconds = Math.floor(data.ClockMs / 1000);
                } else {
                    // Fallback to ScheduledEnd if ClockMs missing
                    const now = new Date();
                    const endTime = new Date(data.ScheduledEnd);
                    remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
                }
            }

        } catch (err) {
            console.log("Error parsing SMS message:", err.message);
        }
    });

    ws.on("close", () => {
        console.log("Disconnected from SMS. Reconnecting in 5s...");
        connected = false;
        setTimeout(connectToSms, 5000);
    });

    ws.on("error", (err) => {
        console.log("WebSocket error:", err.message);
        ws.close();
    });
}

// Start WebSocket connection
connectToSms();

// ---------------------------
// API ENDPOINT: session.json
// ---------------------------
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
