/*
====================================================
KART TIMER SERVER
----------------------------------------------------
What this server does:
1. Connects to SMS Timing WebSocket
2. Listens for live race data
3. Stores latest race message
4. Calculates remaining session time
5. Exposes data at /session.json
6. Serves your public HTML page
====================================================
*/

// Import required packages
const express = require("express");      // Web server framework
const WebSocket = require("ws");         // WebSocket client for SMS Timing
const path = require("path");            // Helps with file paths

// Create Express app
const app = express();

/*
====================================================
CONFIGURATION
====================================================
*/

// IMPORTANT: Cloud hosting requires this format
// If process.env.PORT exists (cloud), use it.
// Otherwise default to 3000 for local use.
const PORT = process.env.PORT || 3000;

// SMS Timing WebSocket server details
const SMS_HOST = "wss://webserver4.sms-timing.com:10015";

/*
====================================================
STATE VARIABLES
====================================================
*/

// Track whether WebSocket is connected
let connected = false;

// Store latest full race message (BcRace)
let lastRaceMessage = null;

// Track remaining seconds in session
let remainingSeconds = 0;

// Track session status
let sessionStatus = "UNKNOWN";

/*
====================================================
CONNECT TO SMS TIMING WEBSOCKET
====================================================
*/

function connectToSms() {

    console.log("Connecting to SMS Timing...");

    // Create WebSocket connection
    const ws = new WebSocket(SMS_HOST);

    // When connection opens
    ws.on("open", () => {

        console.log("Connected to SMS Timing");

        connected = true;

        // Send subscription message to request race data
        ws.send(JSON.stringify({
            "$type": "BcStart",
            "ClientKey": "teamsportmanchestertraffordpark",
            "ResourceId": "19476",
            "Timing": true,
            "Notifications": true,
            "Security": "THIRD PARTY TV"
        }));
    });

    /*
    ============================================
    WHEN WE RECEIVE DATA FROM SMS
    ============================================
    */
    ws.on("message", (message) => {

        try {
            const data = JSON.parse(message);

            // We only care about race updates
            if (data.$type === "BcRace") {

                lastRaceMessage = data;

                // Update session status
                sessionStatus = data.RaceState || "UNKNOWN";

                // Calculate remaining time
                // ScheduledEnd is an ISO date string
                const now = new Date();
                const endTime = new Date(data.ScheduledEnd);

                const diffMs = endTime - now;

                // Convert milliseconds to seconds
                remainingSeconds = Math.max(
                    0,
                    Math.floor(diffMs / 1000)
                );
            }

        } catch (err) {
            console.log("Error parsing message:", err.message);
        }
    });

    /*
    ============================================
    HANDLE DISCONNECTS
    ============================================
    */
    ws.on("close", () => {
        console.log("Disconnected from SMS. Reconnecting in 5s...");
        connected = false;

        // Try reconnect after 5 seconds
        setTimeout(connectToSms, 5000);
    });

    ws.on("error", (err) => {
        console.log("WebSocket error:", err.message);
        ws.close();
    });
}

// Start connection
connectToSms();

/*
====================================================
API ENDPOINT
====================================================
*/

// This is what your HTML page fetches
app.get("/session.json", (req, res) => {

    res.json({
        connected,
        remainingSeconds,
        sessionStatus,
        lastRaceMessage
    });
});

/*
====================================================
SERVE STATIC WEBSITE
====================================================
*/

// Serves files inside the "public" folder
app.use(express.static(path.join(__dirname, "public")));

/*
====================================================
START SERVER
====================================================
*/

app.listen(PORT, () => {
    console.log(`==================================`);
    console.log(`Kart Timer Server Running`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`==================================`);
});
