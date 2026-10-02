import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client to avoid crashing on start if the key is missing
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined. Please add it to the Secrets panel.');
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return ai;
}

// Dynamic Local Fallback Commentary Generator for Rate-Limiting/Offline/Error resilience
function generateLocalCommentary(
  trackName: string,
  eventType: string,
  playerLap: number,
  playerPosition: any,
  competitorName: string,
  speed: number,
  personality: string
): string {
  const p = personality || 'Excited GP Announcer';
  const competitor = competitorName || 'competitor';
  const posNum = playerPosition || 4;
  
  let pos = `${posNum}`;
  if (typeof posNum === 'number' || !isNaN(Number(posNum))) {
    const num = Number(posNum);
    if (num === 1) pos = '1st';
    else if (num === 2) pos = '2nd';
    else if (num === 3) pos = '3rd';
    else pos = `${num}th`;
  }

  const track = trackName || 'the circuit';
  const lap = playerLap || 1;
  const roundedSpeed = Math.round(speed || 0);

  const database: Record<string, Record<string, string[]>> = {
    'Excited GP Announcer': {
      race_start: [
        `GREEN LIGHT! We are racing on ${track}! The asphalt is burning and engines are screaming!`,
        `THEY ARE OFF! Five supercars roar to life under the lights of ${track}! Let's go!`,
        `GO, GO, GO! The championship event at ${track} has officially begun!`
      ],
      lap_completed: [
        `WHAT A LAP! The player starts Lap ${lap} with pure speed!`,
        `Crossing the line! Lap ${lap} is underway, and the crowd is going absolutely wild!`,
        `Another lap in the bag! Keep pushing that pedal to the metal!`
      ],
      crash_wall: [
        `UNBELIEVABLE! A massive crash into the barriers at ${roundedSpeed} MPH! That's gotta hurt!`,
        `CRASH! Plunged straight into the concrete! Can they recover from that devastating wall bump?`,
        `OH! Metal scraping against concrete! The steering wheels must be shaking!`
      ],
      overtook_competitor: [
        `WHAT A MOVE! The player completely leaves ${competitor} in the dust!`,
        `SPECTACULAR PASS! ${competitor} is overtaken! The crowd rises to their feet!`,
        `SLICED THROUGH! Player moves ahead of ${competitor} with absolute racing perfection!`
      ],
      nitro_activated: [
        `NITRO BOOST IGNITED! Pure blue fire from the exhausts!`,
        `BURNING RUBBER! The nitrous canister is open and they are flying at ${roundedSpeed} MPH!`,
        `SUPERCHARGED BOOST! Absolute rockets attached to the chassis right now!`
      ],
      hit_oil: [
        `SPINNING OUT! They hit the oil puddle! Pure chaos on the tarmac!`,
        `SLIP AND SLIDE! No traction! The car is doing a 360 spin!`,
        `OIL SLICKED! Unbelievable loss of grip, they are spinning out of control!`
      ],
      race_finished_win: [
        `VICTORY! 🏆 Player takes 1st place! A legendary drive on ${track}!`,
        `CHEQUERED FLAG! First place is secured! What an absolute masterpiece of racing!`,
        `WINNER! Player crosses the finish line in absolute triumph! Champions of ${track}!`
      ],
      race_finished_podium: [
        `PODIUM SECURED! What a spectacular race! A solid top-three finish!`,
        `GREAT FINISH! On the podium with pride! Excellent tire management!`,
        `A PODIUM RUN! Third or second place secured under intense pressure!`
      ],
      race_finished_loss: [
        `RACE OVER! Better luck next time. The competition was fierce today.`,
        `Crossed the line! A tough race, but some valuable reputation points earned!`,
        `FINISH! Not the podium they wanted, but those lap times are looking promising.`
      ]
    },
    'Sarcastic Mechanic': {
      race_start: [
        `Green flag. Try not to dent the bumper in the first ten seconds, alright?`,
        `And we're off. I spent five hours tuning that gearbox, so don't blow it up!`,
        `Race started. Remember, we don't have budget for a new engine this weekend.`
      ],
      lap_completed: [
        `Lap ${lap}. Tires are still attached, surprisingly. Keep moving.`,
        `Starting lap ${lap}. The suspension is crying but she's still rolling!`,
        `Over the line. Only a few more laps before I can go have a coffee.`
      ],
      crash_wall: [
        `Great. Just great. That paint job cost me a week's wages. Thanks.`,
        `Wall collision detected. Next time, try using that circular thing in front of you called a steering wheel!`,
        `Ouch! My tools are already crying. Stop using the concrete wall to brake!`
      ],
      overtook_competitor: [
        `Overtook ${competitor}? Must be because I tuned those injectors perfectly.`,
        `Well, look at you passing ${competitor}. Don't get cocky, we still need to finish.`,
        `Nice pass. ${competitor} probably had their parking brake on, though.`
      ],
      nitro_activated: [
        `Warning: Nitrous active. Hope the cylinder doesn't blow a hole through your seat!`,
        `Injecting the chemical speed. My telemetry is lighting up like a Christmas tree.`,
        `There goes the nitro. Let's hope the gaskets hold together under this PSI!`
      ],
      hit_oil: [
        `Slipped on oil. Did you think it was a purple slip-and-slide out there?`,
        `Spinning like a record. Who put that puddle there? My cleaning bill is rising.`,
        `Traction control is officially on vacation. Nice spin.`
      ],
      race_finished_win: [
        `We won? Unbelievable. I'll get the champagne, you get the wrench.`,
        `First place! Clean the bugs off the windshield and let's cash that check!`,
        `Nice job. Now bring the car back in one piece so I can look at the engine.`
      ],
      race_finished_podium: [
        `Podium! Hey, second or third pays the bills. Good enough.`,
        `A podium finish. I suppose I won't complain about the minor chassis scratches today.`,
        `Not bad. You made it to the podium. I'll only charge you half price for repairs.`
      ],
      race_finished_loss: [
        `Race over. Well, back to garage. We've got a lot of welding to do.`,
        `Fourth or fifth? I guess we're eating instant noodles tonight.`,
        `Finished. At least the engine didn't catch fire. That's a win in my book.`
      ]
    },
    'Zen Racing Coach': {
      race_start: [
        `Breathe in, breathe out. Focus on the apex of ${track}. Let the car flow.`,
        `Engines are warm. Find your rhythm. The race begins now.`,
        `Smooth inputs. Clear your mind and connect with the asphalt.`
      ],
      lap_completed: [
        `Entering Lap ${lap}. Keep your steering fluid and maintain the racing line.`,
        `Lap ${lap}. Beautiful consistency. Feel the weight transfer of the chassis.`,
        `Another lap. Stay in the zone. You are one with the machine.`
      ],
      crash_wall: [
        `A minor disruption in the flow. Release the tension in your shoulders and refocus.`,
        `Hasty steering leads to contact. Regroup, find your center, and keep moving.`,
        `The wall is a rigid teacher. Breathe and regain your composure.`
      ],
      overtook_competitor: [
        `A mindful overtake on ${competitor}. Excellent patience and execution.`,
        `Flowing past ${competitor}. Smooth, decisive, and beautifully controlled.`,
        `You found the gap. Outstanding focus to take the position.`
      ],
      nitro_activated: [
        `Harnessing the extra energy. Flow with the acceleration smoothly.`,
        `Nitrous boost. Keep your eyes far down the track as the speed builds.`,
        `Energy released. Maintain absolute focus on your steering alignment.`
      ],
      hit_oil: [
        `A temporary loss of grip. Flow with the spin, do not fight it.`,
        `Slipping. Balance your breathing and wait for the tires to regain contact.`,
        `The surface is unpredictable. Stay calm and let the car settle.`
      ],
      race_finished_win: [
        `Beautifully driven. 1st place is the natural result of your perfect focus.`,
        `Victory. You mastered the track and yourself today. Well done.`,
        `First place. Pure flow state from start to finish. Truly inspiring.`
      ],
      race_finished_podium: [
        `A podium finish. Excellent balance of aggression and patience today.`,
        `Podium secured. You respected the limits and achieved a beautiful result.`,
        `Harmonious drive. On the podium with grace and excellent composure.`
      ],
      race_finished_loss: [
        `The race has concluded. Every placement is a valuable lesson. Let's meditate on the data.`,
        `Finished. Reflect on the corners where you lost momentum and be proud of your efforts.`,
        `The checker flag wave. Rest your hands. We grow stronger with every mile.`
      ]
    },
    'Cybernetic Co-Pilot': {
      race_start: [
        `System diagnostics: Nominal. Ignition sequence initiated for ${track}.`,
        `Engines online. Topographic map of ${track} loaded. COMMENCING RACE.`,
        `Optimal racing trajectory computed. Synchronizing telemetry nodes now.`
      ],
      lap_completed: [
        `Lap ${lap} initiated. Current thermal output is within acceptable limits.`,
        `Lap ${lap} checkpoint cleared. Analyzing performance metrics.`,
        `Telemetry update: Sector 1 complete. Proceed with maximum velocity.`
      ],
      crash_wall: [
        `CRITICAL IMPACT: Structural integrity compromised by wall collision.`,
        `Collision detected at ${roundedSpeed} MPH. Re-calibrating steering actuators.`,
        `Kinetic impact recorded. Recommend avoiding solid boundaries to prevent deceleration.`
      ],
      overtook_competitor: [
        `Overtake sequence successful. Target ${competitor} has been bypassed.`,
        `Position upgraded. ${competitor} is now behind our current coordinates.`,
        `Overtook ${competitor}. Vector tracking indicates speed differential of +12%.`
      ],
      nitro_activated: [
        `Nitrous injection active. Velocity rising. Fuel-to-air ratio optimized.`,
        `Chemical thrust activated. Speed tracking at ${roundedSpeed} MPH.`,
        `Thrust boosters engaged. Thermal output spiking. Maintain alignment.`
      ],
      hit_oil: [
        `WARNING: Friction coefficient reduced to 0.05. Slip angle critical!`,
        `Centrifugal force threshold exceeded. Correcting spin vector.`,
        `Traction loss detected. Stabilizing gyroscopic coordinates.`
      ],
      race_finished_win: [
        `Simulation concluded: SUCCESS. Player achieved 1st place. Outstanding efficiency.`,
        `Victory protocol engaged. All telemetry indexes indicate a perfect run.`,
        `Destination reached. Position 1/5 secured. Shutting down speed actuators.`
      ],
      race_finished_podium: [
        `Podium secured. Probability of successful championship progression: 92%.`,
        `Race complete. Podium finish achieved. Telemetry stored.`,
        `Data stored. Position within top 3 threshold. Systems returning to standby.`
      ],
      race_finished_loss: [
        `Race complete. Final placement outside podium threshold. Re-evaluating engine upgrades.`,
        `Simulation ended. Optimization required. Position ${pos} recorded.`,
        `Telemetry complete. System standby engaged. Diagnostic log saved.`
      ]
    }
  };

  const pDatabase = database[p] || database['Excited GP Announcer'];
  const lines = pDatabase[eventType] || [
    `The engine hums at ${roundedSpeed} MPH on Lap ${lap}! Focus on the finish!`,
    `Fierce competition on the track! Push the machine to its absolute limits!`
  ];
  const index = Math.floor(Math.random() * lines.length);
  return lines[index];
}

// Live racing commentator API powered by Gemini
app.post('/api/race-commentary', async (req, res) => {
  const { trackName, eventType, playerLap, playerPosition, competitorName, speed, personality } = req.body;

  try {
    if (!trackName || !eventType) {
      return res.status(400).json({ error: 'Missing trackName or eventType.' });
    }

    // Verify if API Key is available
    if (!process.env.GEMINI_API_KEY) {
      const fallback = generateLocalCommentary(trackName, eventType, playerLap, playerPosition, competitorName, speed, personality);
      return res.json({ commentary: fallback });
    }

    const client = getGeminiClient();

    const prompt = `You are an AI racing commentator/coach in a high-speed top-down arcade car racing game.
Current Track: "${trackName}"
Player's Current Lap: ${playerLap || 1}
Player's Position: ${playerPosition || '4th'} / 5 cars
Current Speed: ${Math.round(speed || 0)} MPH
Commentary Event Triggered: "${eventType}"
${competitorName ? `Competitor involved: "${competitorName}"` : ''}

Selected Commentator Personality: "${personality || 'Excited GP Announcer'}"
Personality Reference:
- "Excited GP Announcer": Ultra high-energy, speaks with screaming adrenaline, loves speed, uses racing terms ("UNBELIEVABLE!", "BURNING RUBBER!", "PETROL IN THE VEINS!").
- "Sarcastic Mechanic": Grumpy, grease-monkey, talks about tire wear, gearbox stress, and dented bumpers. Playfully mocks the player's mistakes or warns them about engine temperatures.
- "Zen Racing Coach": Calm, collected, focused on the racing line, breathing, tire grip, and the flow state. Encourages smooth steering and focus.
- "Cybernetic Co-Pilot": AI onboard diagnostic interface, speaking in clinical data metrics. Computes friction coefficients, thermal outputs, and efficiency indices.

Your task:
Write exactly ONE brief, highly immersive commentary line (max 2 short sentences, under 110 characters) reacting to this specific racing event.
Do NOT output any markdown, JSON, quotes, or meta-commentary. Return ONLY the raw direct speech text that can be displayed immediately on subtitles.
Be creative, witty, and stay strictly in character.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const commentaryText = response.text?.trim().replace(/^"|"$/g, '') || "What a magnificent run on the asphalt!";
    return res.json({ commentary: commentaryText });

  } catch (error: any) {
    // If rate-limited or any other exception, gracefully log a simple log and return a rich local fallback commentary
    console.log(`[Commentary Info] Using dynamic local fallback commentary.`);
    const fallback = generateLocalCommentary(trackName, eventType, playerLap, playerPosition, competitorName, speed, personality);
    return res.json({ commentary: fallback });
  }
});

// Serve static assets or mount Vite dev middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
