import gsap from "gsap";

export type HostState =
  "idle" | "wave" | "asking" | "thinking" | "excited" | "sad";

export const HOST_STATE_LABELS: Record<HostState, string> = {
  idle: "State: Idle / Breathing",
  wave: "State: Wave / Welcome",
  asking: "State: Asking Question",
  thinking: "State: Suspense / Thinking",
  excited: "State: Correct Answer! (Excited)",
  sad: "State: Wrong Answer (Sad)",
};

export const HOST_STATE_DIALOGUES: Record<HostState, string> = {
  idle: '"Vanakkam & Namaste! Welcome to the Grand Navaratri Golu Quiz!"',
  wave: '"Hello friends! Step right up to the Kolu Padi—let\'s play!"',
  asking:
    '"For 500 points: Which clay doll set is always placed at the heart of a traditional Golu?"',
  thinking: '"Hmm... the clock is ticking! Are you locking in Option B?"',
  excited: '"SHABASH! Spot on! That wins you the Golden Kalash Bonus!"',
  sad: '"Ayyo! So close, my friend... that was actually the Marapachi doll pair."',
};

export const HOST_CODE_SNIPPETS: Record<HostState, string> = {
  idle: `// 1. IDLE / BREATHING STATE
const tl = gsap.timeline({ repeat: -1, yoyo: true });

// Gentle breathing scale from the waist pivot
tl.to("#upper-body", {
  scaleY: 1.025,
  y: -4,
  svgOrigin: "300 495",
  duration: 1.6,
  ease: "sine.inOut"
}, 0);

// Subtle clay-doll head bobble
tl.to("#head-group", {
  rotation: 2.5,
  svgOrigin: "300 310",
  duration: 2.2,
  ease: "sine.inOut"
}, 0);`,

  wave: `// 2. WAVE / WELCOME STATE
const tl = gsap.timeline({ repeat: -1, yoyo: true });

// Rotate right arm from shoulder pivot (215, 345)
tl.to("#arm-right-wave", {
  rotation: 26,
  svgOrigin: "215 345",
  duration: 0.35,
  ease: "sine.inOut"
}, 0);

// Secondary wrist wave & cheerful head tilt
tl.to("#hand-right", {
  rotation: 15,
  svgOrigin: "140 238",
  duration: 0.35,
  ease: "sine.inOut"
}, 0).to("#head-group", {
  rotation: -5,
  svgOrigin: "300 310",
  duration: 0.7,
  ease: "sine.inOut"
}, 0);`,

  asking: `// 3. ASKING QUESTION (MIC RAISE + LIP SYNC)
const tl = gsap.timeline({ repeat: -1, yoyo: true });

// Bring left mic arm up toward mouth from shoulder (385, 345)
gsap.to("#arm-left-mic", {
  rotation: 18,
  x: -8,
  y: -14,
  svgOrigin: "385 345",
  duration: 0.45,
  ease: "back.out(1.7)"
});

// Expressive host gestures with right arm & head
tl.to("#arm-right-wave", {
  rotation: -14,
  svgOrigin: "215 345",
  duration: 0.8,
  ease: "sine.inOut"
}, 0).to("#head-group", {
  rotation: 4,
  y: -3,
  svgOrigin: "300 310",
  duration: 0.6
}, 0);`,

  thinking: `// 4. THINKING / SUSPENSE (WAITING FOR ANSWER)
// Asymmetric inquisitive eyebrows & pursed mouth
gsap.set("#mouth-open-smile", { opacity: 0 });
gsap.set("#mouth-thinking", { opacity: 1 });
gsap.to("#brow-left", { y: -9, rotation: -8, svgOrigin: "264 175", duration: 0.3 });
gsap.to("#brow-right", { y: 5, rotation: -6, svgOrigin: "336 175", duration: 0.3 });

// Shift pupils side-to-side while waiting
const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.5 });
tl.fromTo("#pupils",
  { x: -7, y: -3 },
  { x: 7, y: -3, duration: 0.9, ease: "power2.inOut" }
);`,

  excited: `// 5. EXCITED / CORRECT ANSWER CELEBRATION!
// Swap in Starry Eyes & Golden Stage Burst
gsap.set("#eyes-open", { opacity: 0 });
gsap.set("#eyes-excited", { opacity: 1 });
gsap.to("#bg-excited-burst", { opacity: 0.95, duration: 0.3 });

// Joyful jump on the clay pedestal with squash & stretch
const tl = gsap.timeline({ repeat: -1 });
tl.to("#doll-assembly", {
  y: -34, scaleY: 1.05, scaleX: 0.96,
  svgOrigin: "300 650", duration: 0.28, ease: "power2.out"
})
.to("#doll-assembly", {
  y: 0, scaleY: 0.94, scaleX: 1.05,
  svgOrigin: "300 650", duration: 0.24, ease: "bounce.out"
})
.to("#doll-assembly", { scaleY: 1, scaleX: 1, duration: 0.15 });`,

  sad: `// 6. SAD / WRONG ANSWER REACTION
// Swap to frown mouth, upturned sad brows & dim stage
gsap.set("#mouth-open-smile", { opacity: 0 });
gsap.set("#mouth-sad", { opacity: 1 });
gsap.to("#bg-sad-dim", { opacity: 0.55, duration: 0.4 });

// Droop shoulders, mustache & head
gsap.to("#upper-body", { y: 10, scaleY: 0.96, svgOrigin: "300 495", duration: 0.5 });
gsap.to("#mustache", { rotation: -6, y: 5, svgOrigin: "300 242", duration: 0.4 });
gsap.to("#arm-right-wave", { rotation: -38, svgOrigin: "215 345", duration: 0.6 });

// Sympathetic slow head shake
gsap.fromTo("#head-group",
  { rotation: -5, y: 12, svgOrigin: "300 310" },
  { rotation: 5, y: 12, svgOrigin: "300 310", duration: 0.9, repeat: -1, yoyo: true, ease: "sine.inOut" }
);`,
};

export const RAJA_BOMMAI_SVG = `<svg
  id="raja-svg"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 600 750"
  class="raja-svg"
  aria-label="Raja Bommai Game Show Host"
>
  <defs>
    <radialGradient id="stage-glow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#FFF5D6" />
      <stop offset="60%" stop-color="#FFE0B2" />
      <stop offset="100%" stop-color="#F57C00" stop-opacity="0.15" />
    </radialGradient>

    <radialGradient id="excited-glow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#FFF9C4" />
      <stop offset="50%" stop-color="#FFD54F" />
      <stop offset="100%" stop-color="#FF6F00" stop-opacity="0" />
    </radialGradient>

    <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE57F" />
      <stop offset="50%" stop-color="#FFC107" />
      <stop offset="100%" stop-color="#FFA000" />
    </linearGradient>

    <linearGradient id="jacket-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#D81B60" />
      <stop offset="100%" stop-color="#880E4F" />
    </linearGradient>

    <linearGradient id="silk-teal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00BFA5" />
      <stop offset="100%" stop-color="#00796B" />
    </linearGradient>

    <linearGradient id="clay-skin" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E69A68" />
      <stop offset="100%" stop-color="#C87A48" />
    </linearGradient>

    <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow
        dx="0"
        dy="6"
        stdDeviation="6"
        flood-color="#1E100D"
        flood-opacity="0.35"
      />
    </filter>
  </defs>

  <g id="background-stage">
    <circle id="bg-spotlight" cx="300" cy="360" r="270" fill="url(#stage-glow)" />
    <circle id="bg-excited-burst" cx="300" cy="360" r="290" fill="url(#excited-glow)" opacity="0" />
    <circle id="bg-sad-dim" cx="300" cy="360" r="275" fill="#1E293B" opacity="0" />

    <g id="marigold-toran">
      <path
        d="M 90,80 Q 195,140 300,80 Q 405,140 510,80"
        fill="none"
        stroke="#388E3C"
        stroke-width="6"
        stroke-linecap="round"
      />
      <circle class="toran-flower" cx="90" cy="80" r="16" fill="#FF9800" stroke="#E65100" stroke-width="3" />
      <circle class="toran-flower" cx="142" cy="103" r="14" fill="#FFC107" stroke="#FF8F00" stroke-width="3" />
      <circle class="toran-flower" cx="195" cy="110" r="16" fill="#FF9800" stroke="#E65100" stroke-width="3" />
      <circle class="toran-flower" cx="247" cy="103" r="14" fill="#FFC107" stroke="#FF8F00" stroke-width="3" />
      <circle class="toran-flower" cx="300" cy="80" r="18" fill="#FF5722" stroke="#BF360C" stroke-width="3" />
      <circle class="toran-flower" cx="352" cy="103" r="14" fill="#FFC107" stroke="#FF8F00" stroke-width="3" />
      <circle class="toran-flower" cx="405" cy="110" r="16" fill="#FF9800" stroke="#E65100" stroke-width="3" />
      <circle class="toran-flower" cx="457" cy="103" r="14" fill="#FFC107" stroke="#FF8F00" stroke-width="3" />
      <circle class="toran-flower" cx="510" cy="80" r="16" fill="#FF9800" stroke="#E65100" stroke-width="3" />
    </g>

    <g id="golu-steps" opacity="0.45">
      <rect x="110" y="520" width="380" height="45" rx="6" fill="#1A237E" />
      <rect x="110" y="520" width="380" height="8" fill="#FFC107" />
      <rect x="75" y="565" width="450" height="45" rx="6" fill="#283593" />
      <rect x="75" y="565" width="450" height="8" fill="#FFC107" />
      <rect x="40" y="610" width="520" height="50" rx="6" fill="#1A237E" />
      <rect x="40" y="610" width="520" height="8" fill="#FFC107" />
    </g>
  </g>

  <g id="character-root" filter="url(#soft-shadow)">
    <ellipse id="ground-shadow" cx="300" cy="685" rx="145" ry="22" fill="#1E100D" opacity="0.4" />

    <g id="doll-assembly">
      <g id="doll-pedestal">
        <path
          d="M 175,645 L 425,645 L 440,678 C 440,692 160,692 160,678 Z"
          fill="#BF360C"
          stroke="#3E2723"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <ellipse cx="300" cy="645" rx="125" ry="18" fill="#D84315" stroke="#3E2723" stroke-width="5" />
        <path
          d="M 185,666 L 200,656 L 215,666 L 230,656 L 245,666 L 260,656 L 275,666 L 290,656 L 305,666 L 320,656 L 335,666 L 350,656 L 365,666 L 380,656 L 395,666 L 410,656"
          fill="none"
          stroke="#FFF8E1"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="300" cy="675" r="4" fill="#FFC107" />
        <circle cx="240" cy="673" r="4" fill="#FFC107" />
        <circle cx="360" cy="673" r="4" fill="#FFC107" />
      </g>

      <g id="legs-and-feet">
        <path
          d="M 225,485 L 220,625 C 220,635 285,635 290,625 L 295,500 Z"
          fill="#FFF8E1"
          stroke="#3E2723"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <path
          d="M 375,485 L 380,625 C 380,635 315,635 310,625 L 305,500 Z"
          fill="#FFF8E1"
          stroke="#3E2723"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <path
          d="M 282,485 L 272,632 L 328,632 L 318,485 Z"
          fill="url(#gold-grad)"
          stroke="#3E2723"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <line x1="292" y1="490" x2="288" y2="630" stroke="#B26A00" stroke-width="3" />
        <line x1="308" y1="490" x2="312" y2="630" stroke="#B26A00" stroke-width="3" />
        <path d="M 235,530 Q 260,545 275,525" fill="none" stroke="#E0C097" stroke-width="4" stroke-linecap="round" />
        <path d="M 232,575 Q 260,590 274,570" fill="none" stroke="#E0C097" stroke-width="4" stroke-linecap="round" />
        <path d="M 365,530 Q 340,545 325,525" fill="none" stroke="#E0C097" stroke-width="4" stroke-linecap="round" />
        <path d="M 368,575 Q 340,590 326,570" fill="none" stroke="#E0C097" stroke-width="4" stroke-linecap="round" />
        <path
          d="M 210,638 C 195,638 190,620 202,615 C 208,612 212,625 225,625 L 280,625 C 288,625 290,645 275,645 L 210,645 Z"
          fill="#D81B60"
          stroke="#3E2723"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <circle cx="200" cy="616" r="6" fill="#FFC107" stroke="#3E2723" stroke-width="3" />
        <path
          d="M 390,638 C 405,638 410,620 398,615 C 392,612 388,625 375,625 L 320,625 C 312,625 310,645 325,645 L 390,645 Z"
          fill="#D81B60"
          stroke="#3E2723"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <circle cx="400" cy="616" r="6" fill="#FFC107" stroke="#3E2723" stroke-width="3" />
      </g>

      <g id="upper-body">
        <g id="arm-right-wave">
          <path
            d="M 220,335 C 175,335 135,305 115,245 L 155,225 C 170,270 195,290 230,295 Z"
            fill="url(#jacket-grad)"
            stroke="#3E2723"
            stroke-width="5"
            stroke-linejoin="round"
          />
          <polygon
            points="112,250 158,230 164,244 118,264"
            fill="url(#gold-grad)"
            stroke="#3E2723"
            stroke-width="4"
            stroke-linejoin="round"
          />
          <g id="hand-right">
            <path
              d="M 118,242 C 98,225 85,195 95,185 C 103,178 115,198 120,205 C 115,182 122,165 132,168 C 142,170 138,192 138,202 C 142,180 154,168 162,174 C 170,180 158,202 154,210 C 164,195 176,190 180,198 C 185,206 168,224 158,232 C 172,226 184,230 182,240 C 180,250 155,252 142,248 Z"
              fill="url(#clay-skin)"
              stroke="#3E2723"
              stroke-width="4.5"
              stroke-linejoin="round"
            />
            <circle cx="140" cy="224" r="7" fill="#D81B60" opacity="0.6" />
          </g>
        </g>

        <g id="torso-group">
          <path
            d="M 210,320 C 260,310 340,310 390,320 L 385,505 C 330,520 270,520 215,505 Z"
            fill="url(#jacket-grad)"
            stroke="#3E2723"
            stroke-width="5"
            stroke-linejoin="round"
          />
          <path
            d="M 255,305 C 285,322 315,322 345,305 L 355,328 C 315,345 285,345 245,328 Z"
            fill="#4A0E2E"
            stroke="#3E2723"
            stroke-width="5"
            stroke-linejoin="round"
          />
          <path d="M 260,315 C 290,330 310,330 340,315" fill="none" stroke="url(#gold-grad)" stroke-width="4" stroke-linecap="round" />
          <path d="M 248,325 Q 300,425 352,325" fill="none" stroke="#FFF8E1" stroke-width="12" stroke-linecap="round" />
          <path d="M 248,325 Q 300,425 352,325" fill="none" stroke="#FF9800" stroke-width="8" stroke-dasharray="2 16" stroke-linecap="round" />
          <circle cx="300" cy="382" r="11" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="4" />
          <circle cx="300" cy="415" r="6" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="3" />
          <circle cx="300" cy="445" r="6" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="3" />
          <circle cx="300" cy="475" r="6" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="3" />
          <path
            d="M 205,318 C 255,375 325,430 392,455 L 388,500 C 310,475 240,415 200,355 Z"
            fill="url(#silk-teal)"
            stroke="#3E2723"
            stroke-width="5"
            stroke-linejoin="round"
          />
          <path d="M 203,345 C 245,405 312,462 389,488" fill="none" stroke="url(#gold-grad)" stroke-width="7" />
          <g transform="translate(345, 375) rotate(12)">
            <polygon
              points="0,-20 6,-7 20,-5 10,5 12,19 0,12 -12,19 -10,5 -20,-5 -6,-7"
              fill="url(#gold-grad)"
              stroke="#3E2723"
              stroke-width="3.5"
              stroke-linejoin="round"
            />
            <circle cx="0" cy="1" r="6" fill="#D81B60" />
          </g>
        </g>

        <g id="arm-left-mic">
          <path
            d="M 380,330 C 425,345 455,395 430,435 C 410,460 365,440 345,410 L 370,380 C 385,395 398,405 405,395 C 412,385 395,365 375,360 Z"
            fill="url(#jacket-grad)"
            stroke="#3E2723"
            stroke-width="5"
            stroke-linejoin="round"
          />
          <polygon points="340,412 372,376 382,386 350,422" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="4" stroke-linejoin="round" />
          <g id="mic-and-hand">
            <rect
              x="336"
              y="325"
              width="16"
              height="85"
              rx="6"
              transform="rotate(-15 344 365)"
              fill="#263238"
              stroke="#3E2723"
              stroke-width="4.5"
            />
            <g transform="translate(336, 336) rotate(-15)">
              <rect x="-22" y="-16" width="44" height="30" rx="5" fill="#FFC107" stroke="#3E2723" stroke-width="4.5" />
              <text x="0" y="6" font-family="sans-serif" font-weight="900" font-size="20" fill="#880E4F" text-anchor="middle">G</text>
            </g>
            <g transform="translate(326, 298) rotate(-15)">
              <ellipse cx="0" cy="0" rx="22" ry="26" fill="#ECEFF1" stroke="#3E2723" stroke-width="4.5" />
              <path d="M -18,-8 L 18,-8 M -21,2 L 21,2 M -18,12 L 18,12" stroke="#90A4AE" stroke-width="3" />
              <path d="M -8,-23 L -8,23 M 0,-25 L 0,25 M 8,-23 L 8,23" stroke="#90A4AE" stroke-width="3" />
              <ellipse cx="0" cy="0" rx="22" ry="26" fill="none" stroke="#3E2723" stroke-width="4.5" />
              <rect x="-23" y="-3" width="46" height="6" rx="3" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="3" />
            </g>
            <path
              d="M 332,375 C 320,375 318,408 335,412 L 362,412 C 375,412 375,375 358,375 Z"
              fill="url(#clay-skin)"
              stroke="#3E2723"
              stroke-width="4.5"
              stroke-linejoin="round"
            />
            <line x1="326" y1="387" x2="348" y2="387" stroke="#3E2723" stroke-width="3.5" stroke-linecap="round" />
            <line x1="326" y1="399" x2="348" y2="399" stroke="#3E2723" stroke-width="3.5" stroke-linecap="round" />
            <path d="M 345,372 C 362,372 368,388 352,392 C 340,394 338,380 345,372 Z" fill="url(#clay-skin)" stroke="#3E2723" stroke-width="4" />
          </g>
        </g>

        <g id="head-group">
          <rect x="276" y="285" width="48" height="40" rx="12" fill="url(#clay-skin)" stroke="#3E2723" stroke-width="5" />

          <g id="ears">
            <ellipse cx="205" cy="225" rx="16" ry="24" fill="url(#clay-skin)" stroke="#3E2723" stroke-width="5" />
            <circle cx="202" cy="248" r="11" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="4" />
            <circle cx="202" cy="248" r="4" fill="#D81B60" />
            <ellipse cx="395" cy="225" rx="16" ry="24" fill="url(#clay-skin)" stroke="#3E2723" stroke-width="5" />
            <circle cx="398" cy="248" r="11" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="4" />
            <circle cx="398" cy="248" r="4" fill="#D81B60" />
          </g>

          <path
            d="M 212,185 C 212,115 388,115 388,185 C 396,245 365,302 300,302 C 235,302 204,245 212,185 Z"
            fill="url(#clay-skin)"
            stroke="#3E2723"
            stroke-width="5"
            stroke-linejoin="round"
          />

          <g id="cheeks">
            <ellipse id="cheek-left" cx="242" cy="238" rx="18" ry="11" fill="#FF5252" opacity="0.45" />
            <ellipse id="cheek-right" cx="358" cy="238" rx="18" ry="11" fill="#FF5252" opacity="0.45" />
          </g>
          <path d="M 225,180 Q 220,205 228,220" fill="none" stroke="#FFF8E1" stroke-width="4" stroke-linecap="round" opacity="0.5" />

          <g id="tilak">
            <path d="M 278,162 Q 300,168 322,162" fill="none" stroke="#FFF8E1" stroke-width="4.5" stroke-linecap="round" />
            <path d="M 282,171 Q 300,176 318,171" fill="none" stroke="#FFF8E1" stroke-width="4.5" stroke-linecap="round" />
            <path d="M 300,152 C 307,164 307,175 300,175 C 293,175 293,164 300,152 Z" fill="#D50000" stroke="#3E2723" stroke-width="2" />
          </g>

          <g id="eyes-open" opacity="1">
            <ellipse cx="264" cy="208" rx="22" ry="25" fill="#FFFFFF" stroke="#3E2723" stroke-width="5" />
            <ellipse cx="336" cy="208" rx="22" ry="25" fill="#FFFFFF" stroke="#3E2723" stroke-width="5" />
            <g id="pupils">
              <circle cx="266" cy="210" r="13" fill="#212121" />
              <circle cx="261" cy="203" r="5" fill="#FFFFFF" />
              <circle cx="272" cy="216" r="2.5" fill="#FFFFFF" />
              <circle cx="334" cy="210" r="13" fill="#212121" />
              <circle cx="329" cy="203" r="5" fill="#FFFFFF" />
              <circle cx="340" cy="216" r="2.5" fill="#FFFFFF" />
            </g>
          </g>

          <g id="eyes-blink" opacity="0">
            <path d="M 242,210 Q 264,228 286,210" fill="none" stroke="#3E2723" stroke-width="6" stroke-linecap="round" />
            <path d="M 314,210 Q 336,228 358,210" fill="none" stroke="#3E2723" stroke-width="6" stroke-linecap="round" />
          </g>

          <g id="eyes-excited" opacity="0">
            <path d="M 242,214 Q 264,190 286,214" fill="none" stroke="#3E2723" stroke-width="6.5" stroke-linecap="round" />
            <path d="M 314,214 Q 336,190 358,214" fill="none" stroke="#3E2723" stroke-width="6.5" stroke-linecap="round" />
            <polygon points="264,196 267,204 275,204 269,209 271,217 264,212 257,217 259,209 253,204 261,204" fill="#FFC107" stroke="#3E2723" stroke-width="2" />
            <polygon points="336,196 339,204 347,204 341,209 343,217 336,212 329,217 331,209 325,204 333,204" fill="#FFC107" stroke="#3E2723" stroke-width="2" />
          </g>

          <g id="eyebrows">
            <path id="brow-left" d="M 238,180 Q 264,166 286,178" fill="none" stroke="#212121" stroke-width="7" stroke-linecap="round" />
            <path id="brow-right" d="M 314,178 Q 336,166 362,180" fill="none" stroke="#212121" stroke-width="7" stroke-linecap="round" />
          </g>

          <path
            d="M 300,205 C 294,222 288,230 302,233 C 308,234 312,230 312,226"
            fill="url(#clay-skin)"
            stroke="#3E2723"
            stroke-width="4.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <g id="mouth-open-smile" opacity="1">
            <path d="M 262,250 C 262,286 338,286 338,250 Z" fill="#6D1B1B" stroke="#3E2723" stroke-width="4.5" stroke-linejoin="round" />
            <path d="M 266,252 L 334,252 C 332,262 268,262 266,252 Z" fill="#FFFFFF" />
            <path d="M 280,270 Q 300,258 320,270 C 312,279 288,279 280,270 Z" fill="#FF7043" />
          </g>

          <g id="mouth-talk-closed" opacity="0">
            <ellipse cx="300" cy="262" rx="15" ry="12" fill="#6D1B1B" stroke="#3E2723" stroke-width="4.5" />
            <path d="M 290,268 Q 300,263 310,268" fill="none" stroke="#FF7043" stroke-width="4" stroke-linecap="round" />
          </g>

          <g id="mouth-sad" opacity="0">
            <path d="M 272,268 Q 300,250 328,268" fill="none" stroke="#3E2723" stroke-width="5.5" stroke-linecap="round" />
          </g>

          <g id="mouth-thinking" opacity="0">
            <path d="M 285,260 Q 302,256 318,264" fill="none" stroke="#3E2723" stroke-width="5.5" stroke-linecap="round" />
          </g>

          <g id="mustache">
            <path
              d="M 300,244 C 282,236 262,254 244,246 C 232,240 236,226 246,230 C 252,233 248,240 258,240 C 272,240 284,230 300,238 C 316,230 328,240 342,240 C 352,240 348,233 354,230 C 364,226 368,240 356,246 C 338,254 318,236 300,244 Z"
              fill="#212121"
              stroke="#3E2723"
              stroke-width="3"
              stroke-linejoin="round"
            />
          </g>

          <g id="turban-headgear">
            <path
              d="M 212,195 C 208,165 220,155 230,155 L 370,155 C 380,155 392,165 388,195 C 382,175 370,165 300,165 C 230,165 218,175 212,195 Z"
              fill="#212121"
            />
            <g id="turban-fan">
              <path
                d="M 255,95 L 268,52 L 284,78 L 300,45 L 316,78 L 332,52 L 345,95 Z"
                fill="#D81B60"
                stroke="#3E2723"
                stroke-width="5"
                stroke-linejoin="round"
              />
              <path d="M 268,52 L 300,95 M 300,45 L 300,95 M 332,52 L 300,95" stroke="url(#gold-grad)" stroke-width="3" />
            </g>
            <path
              d="M 198,162 C 185,115 235,82 300,88 C 365,82 415,115 402,162 C 375,142 335,142 300,152 C 265,142 225,142 198,162 Z"
              fill="#FFC107"
              stroke="#3E2723"
              stroke-width="5"
              stroke-linejoin="round"
            />
            <path
              d="M 206,148 C 230,108 310,102 394,148 C 365,126 260,122 206,148 Z"
              fill="#D81B60"
              stroke="#3E2723"
              stroke-width="4.5"
              stroke-linejoin="round"
            />
            <path d="M 225,112 Q 300,95 375,112" fill="none" stroke="#FFF8E1" stroke-width="4" stroke-linecap="round" opacity="0.8" />
            <g id="turban-jewel" transform="translate(300, 130)">
              <circle cx="0" cy="0" r="18" fill="url(#gold-grad)" stroke="#3E2723" stroke-width="4.5" />
              <circle cx="0" cy="0" r="10" fill="#00BFA5" stroke="#3E2723" stroke-width="3" />
              <circle cx="-3" cy="-3" r="3" fill="#FFFFFF" />
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>

  <g id="sparkles">
    <path id="sparkle-1" d="M 85,145 Q 105,145 105,125 Q 105,145 125,145 Q 105,145 105,165 Q 105,145 85,145 Z" fill="#FFC107" stroke="#3E2723" stroke-width="2.5" />
    <path id="sparkle-2" d="M 475,255 Q 490,255 490,240 Q 490,255 505,255 Q 490,255 490,270 Q 490,255 475,255 Z" fill="#FFC107" stroke="#3E2723" stroke-width="2.5" />
    <path id="sparkle-3" d="M 465,135 Q 482,135 482,118 Q 482,135 499,135 Q 482,135 482,152 Q 482,135 465,135 Z" fill="#00E5FF" stroke="#3E2723" stroke-width="2.5" opacity="0" />
    <path id="sparkle-4" d="M 95,310 Q 112,310 112,293 Q 112,310 129,310 Q 112,310 112,327 Q 112,310 95,310 Z" fill="#FF4081" stroke="#3E2723" stroke-width="2.5" opacity="0" />
    <circle class="confetti-dot" cx="145" cy="115" r="6" fill="#D81B60" />
    <circle class="confetti-dot" cx="485" cy="210" r="7" fill="#00BFA5" />
    <circle class="confetti-dot" cx="130" cy="265" r="6" fill="#FFC107" />
    <circle class="confetti-dot" cx="445" cy="120" r="6" fill="#FF5722" />
  </g>

  <g id="pivot-markers" opacity="0" pointer-events="none">
    <circle cx="300" cy="650" r="7" fill="#00E676" stroke="#000" stroke-width="2" />
    <text x="312" y="654" fill="#00E676" font-size="12" font-weight="bold">Base (300,650)</text>
    <circle cx="300" cy="495" r="7" fill="#00E5FF" stroke="#000" stroke-width="2" />
    <text x="312" y="499" fill="#00E5FF" font-size="12" font-weight="bold">Waist (300,495)</text>
    <circle cx="300" cy="310" r="7" fill="#FFEA00" stroke="#000" stroke-width="2" />
    <text x="312" y="314" fill="#FFEA00" font-size="12" font-weight="bold">Head (300,310)</text>
    <circle cx="215" cy="345" r="7" fill="#FF4081" stroke="#000" stroke-width="2" />
    <text x="105" y="349" fill="#FF4081" font-size="12" font-weight="bold">R-Arm (215,345)</text>
    <circle cx="385" cy="345" r="7" fill="#FF4081" stroke="#000" stroke-width="2" />
    <text x="397" y="349" fill="#FF4081" font-size="12" font-weight="bold">L-Arm (385,345)</text>
  </g>
</svg>`;

export interface RajaBommaiOptions {
  initialState?: HostState;
  autoBlink?: boolean;
  onStateChange?: (state: HostState) => void;
  onTalkChange?: (talking: boolean) => void;
}

function ensureSvgTransformConsolidate(svg: SVGSVGElement): void {
  const baseVal = svg.transform?.baseVal as
    | (SVGTransformList & {
        consolidate?: () => {
          matrix: {
            a: number;
            b: number;
            c: number;
            d: number;
            e: number;
            f: number;
          };
        };
      })
    | undefined;
  if (!baseVal || typeof baseVal.consolidate === "function") return;
  const proto = Object.getPrototypeOf(baseVal) as {
    consolidate?: (this: SVGTransformList) => {
      matrix: {
        a: number;
        b: number;
        c: number;
        d: number;
        e: number;
        f: number;
      };
    };
  };
  proto.consolidate = function consolidate(this: SVGTransformList) {
    if (this.numberOfItems > 0) {
      return this.getItem(0);
    }
    return { matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } };
  };
}

export class RajaBommaiHost {
  readonly element: HTMLElement;
  readonly svg: SVGSVGElement;
  private mainTimeline: gsap.core.Timeline | null = null;
  private talkTimeline: gsap.core.Timeline | null = null;
  private talkStopTimer: ReturnType<typeof setTimeout> | null = null;
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private currentState: HostState = "idle";
  private talking = false;
  private destroyed = false;
  private readonly onStateChange?: (state: HostState) => void;
  private readonly onTalkChange?: (talking: boolean) => void;

  constructor(container?: HTMLElement, options: RajaBommaiOptions = {}) {
    this.element = container ?? document.createElement("div");
    this.onStateChange = options.onStateChange;
    this.onTalkChange = options.onTalkChange;

    const existingSvg = this.element.querySelector<SVGSVGElement>("svg");
    if (existingSvg) {
      this.svg = existingSvg;
    } else {
      this.element.innerHTML = RAJA_BOMMAI_SVG;
      this.svg = this.element.querySelector<SVGSVGElement>("svg")!;
    }
    ensureSvgTransformConsolidate(this.svg);

    this.setState(options.initialState ?? "idle");
    if (options.autoBlink !== false) {
      this.scheduleRandomBlink();
    }
  }

  get state(): HostState {
    return this.currentState;
  }

  get isTalking(): boolean {
    return this.talking;
  }

  private q(selector: string): Element[] {
    return Array.from(this.svg.querySelectorAll(selector));
  }

  private qAll(selectors: string[]): Element[] {
    return selectors.flatMap((selector) => this.q(selector));
  }

  private resetRigToNeutral(): void {
    if (this.mainTimeline) {
      this.mainTimeline.kill();
      this.mainTimeline = null;
    }

    const targets = this.qAll([
      "#doll-assembly",
      "#ground-shadow",
      "#upper-body",
      "#head-group",
      "#arm-right-wave",
      "#hand-right",
      "#arm-left-mic",
      "#brow-left",
      "#brow-right",
      "#pupils",
      "#mustache",
      "#turban-fan",
      "#bg-excited-burst",
      "#bg-sad-dim",
      "#sparkle-1",
      "#sparkle-2",
      "#sparkle-3",
      "#sparkle-4",
      ".confetti-dot",
      ".toran-flower",
    ]);
    if (targets.length) gsap.killTweensOf(targets);

    gsap.set(
      this.qAll([
        "#eyes-blink",
        "#eyes-excited",
        "#mouth-talk-closed",
        "#mouth-sad",
        "#mouth-thinking",
      ]),
      { opacity: 0 },
    );
    gsap.set(this.q("#eyes-open"), { opacity: 1 });
    gsap.set(this.q("#mouth-open-smile"), {
      opacity: 1,
      scaleY: 1,
      svgOrigin: "300 255",
    });

    gsap.to(
      this.qAll([
        "#doll-assembly",
        "#upper-body",
        "#head-group",
        "#arm-right-wave",
        "#hand-right",
        "#arm-left-mic",
        "#brow-left",
        "#brow-right",
        "#pupils",
        "#mustache",
        "#turban-fan",
      ]),
      {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.35,
        overwrite: "auto",
      },
    );

    gsap.to(this.q("#ground-shadow"), {
      scaleX: 1,
      opacity: 0.4,
      svgOrigin: "300 685",
      duration: 0.35,
    });
    gsap.to(
      this.qAll([
        "#bg-excited-burst",
        "#bg-sad-dim",
        "#sparkle-3",
        "#sparkle-4",
      ]),
      { opacity: 0, duration: 0.35 },
    );
    gsap.to(
      this.qAll(["#sparkle-1", "#sparkle-2", ".confetti-dot", ".toran-flower"]),
      { scale: 1, rotation: 0, y: 0, duration: 0.35 },
    );
  }

  setState(stateName: HostState): void {
    if (this.destroyed) return;
    this.currentState = stateName;
    this.resetRigToNeutral();

    if (stateName === "asking" && !this.talking) {
      this.setTalking(true);
    } else if (
      (stateName === "thinking" || stateName === "sad") &&
      this.talking
    ) {
      this.setTalking(false);
    }

    this.mainTimeline = gsap.timeline();

    if (stateName === "idle") {
      this.mainTimeline = gsap.timeline({ repeat: -1, yoyo: true });
      this.mainTimeline
        .to(
          this.q("#upper-body"),
          {
            scaleY: 1.022,
            y: -4,
            svgOrigin: "300 495",
            duration: 1.6,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.q("#head-group"),
          {
            rotation: 2.5,
            svgOrigin: "300 310",
            duration: 2.2,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.q("#arm-right-wave"),
          {
            rotation: 4,
            svgOrigin: "215 345",
            duration: 1.6,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.qAll(["#sparkle-1", "#sparkle-2"]),
          {
            scale: 1.2,
            rotation: 15,
            svgOrigin: "300 200",
            duration: 1.6,
            ease: "sine.inOut",
          },
          0,
        );
    } else if (stateName === "wave") {
      gsap.to(this.qAll(["#brow-left", "#brow-right"]), {
        y: -6,
        duration: 0.3,
      });

      this.mainTimeline = gsap.timeline({ repeat: -1, yoyo: true });
      this.mainTimeline
        .to(
          this.q("#arm-right-wave"),
          {
            rotation: 28,
            svgOrigin: "215 345",
            duration: 0.32,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.q("#hand-right"),
          {
            rotation: 18,
            svgOrigin: "140 238",
            duration: 0.32,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.q("#upper-body"),
          {
            rotation: 2.5,
            svgOrigin: "300 495",
            duration: 0.64,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.q("#head-group"),
          {
            rotation: -5,
            y: -3,
            svgOrigin: "300 310",
            duration: 0.64,
            ease: "sine.inOut",
          },
          0,
        );
    } else if (stateName === "asking") {
      gsap.to(this.q("#arm-left-mic"), {
        rotation: 18,
        x: -8,
        y: -14,
        svgOrigin: "385 345",
        duration: 0.45,
        ease: "back.out(1.7)",
      });

      this.mainTimeline = gsap.timeline({ repeat: -1, yoyo: true });
      this.mainTimeline
        .to(
          this.q("#arm-right-wave"),
          {
            rotation: -14,
            svgOrigin: "215 345",
            duration: 0.75,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.q("#head-group"),
          {
            rotation: 4,
            y: -4,
            svgOrigin: "300 310",
            duration: 0.55,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          this.qAll(["#brow-left", "#brow-right"]),
          {
            y: -5,
            duration: 0.55,
            ease: "sine.inOut",
          },
          0,
        );
    } else if (stateName === "thinking") {
      gsap.set(this.q("#mouth-open-smile"), { opacity: 0 });
      gsap.set(this.q("#mouth-thinking"), { opacity: 1 });

      gsap.to(this.q("#brow-left"), {
        y: -10,
        rotation: -8,
        svgOrigin: "264 175",
        duration: 0.35,
      });
      gsap.to(this.q("#brow-right"), {
        y: 5,
        rotation: -6,
        svgOrigin: "336 175",
        duration: 0.35,
      });
      gsap.to(this.q("#head-group"), {
        rotation: -7,
        y: 3,
        svgOrigin: "300 310",
        duration: 0.5,
        ease: "back.out(1.4)",
      });
      gsap.to(this.q("#mustache"), {
        rotation: -4,
        x: 3,
        svgOrigin: "300 242",
        duration: 0.4,
      });

      this.mainTimeline = gsap.timeline({
        repeat: -1,
        yoyo: true,
        repeatDelay: 0.4,
      });
      this.mainTimeline
        .fromTo(
          this.q("#pupils"),
          { x: -8, y: -3 },
          { x: 8, y: -3, duration: 0.85, ease: "power2.inOut" },
          0,
        )
        .to(
          this.q("#hand-right"),
          {
            rotation: -12,
            svgOrigin: "140 238",
            duration: 0.42,
            repeat: 1,
            yoyo: true,
          },
          0,
        );
    } else if (stateName === "excited") {
      gsap.set(this.q("#eyes-open"), { opacity: 0 });
      gsap.set(this.q("#eyes-excited"), { opacity: 1 });
      gsap.to(this.q("#bg-excited-burst"), { opacity: 0.95, duration: 0.3 });
      gsap.to(this.qAll(["#sparkle-3", "#sparkle-4"]), {
        opacity: 1,
        duration: 0.2,
      });
      gsap.to(this.qAll(["#brow-left", "#brow-right"]), {
        y: -10,
        duration: 0.25,
      });

      this.mainTimeline = gsap.timeline({ repeat: -1 });
      this.mainTimeline
        .to(
          this.q("#doll-assembly"),
          {
            y: -36,
            scaleY: 1.05,
            scaleX: 0.96,
            svgOrigin: "300 650",
            duration: 0.28,
            ease: "power2.out",
          },
          0,
        )
        .to(
          this.q("#ground-shadow"),
          {
            scaleX: 0.72,
            opacity: 0.2,
            svgOrigin: "300 685",
            duration: 0.28,
            ease: "power2.out",
          },
          0,
        )
        .to(
          this.q("#arm-right-wave"),
          {
            rotation: 36,
            svgOrigin: "215 345",
            duration: 0.28,
            ease: "back.out(2)",
          },
          0,
        )
        .to(
          this.q("#arm-left-mic"),
          {
            rotation: -24,
            y: -18,
            svgOrigin: "385 345",
            duration: 0.28,
            ease: "back.out(2)",
          },
          0,
        )
        .to(
          this.q("#turban-fan"),
          {
            scaleY: 1.18,
            svgOrigin: "300 95",
            duration: 0.28,
          },
          0,
        )
        .to(
          this.q("#doll-assembly"),
          {
            y: 0,
            scaleY: 0.94,
            scaleX: 1.05,
            svgOrigin: "300 650",
            duration: 0.26,
            ease: "bounce.out",
          },
          0.28,
        )
        .to(
          this.q("#ground-shadow"),
          {
            scaleX: 1.08,
            opacity: 0.45,
            svgOrigin: "300 685",
            duration: 0.26,
            ease: "bounce.out",
          },
          0.28,
        )
        .to(
          this.q("#arm-right-wave"),
          {
            rotation: 10,
            svgOrigin: "215 345",
            duration: 0.26,
          },
          0.28,
        )
        .to(
          this.q("#arm-left-mic"),
          {
            rotation: 0,
            y: 0,
            svgOrigin: "385 345",
            duration: 0.26,
          },
          0.28,
        )
        .to(
          this.q("#doll-assembly"),
          {
            scaleY: 1,
            scaleX: 1,
            svgOrigin: "300 650",
            duration: 0.18,
          },
          0.54,
        );

      gsap.to(
        this.qAll(["#sparkle-1", "#sparkle-2", "#sparkle-3", "#sparkle-4"]),
        {
          scale: 1.35,
          rotation: 25,
          duration: 0.35,
          repeat: -1,
          yoyo: true,
          stagger: 0.08,
        },
      );
      gsap.to(this.q(".toran-flower"), {
        y: -6,
        duration: 0.28,
        repeat: -1,
        yoyo: true,
        stagger: 0.05,
      });
    } else if (stateName === "sad") {
      gsap.set(this.q("#mouth-open-smile"), { opacity: 0 });
      gsap.set(this.q("#mouth-sad"), { opacity: 1 });
      gsap.to(this.q("#bg-sad-dim"), { opacity: 0.55, duration: 0.4 });

      gsap.to(this.q("#brow-left"), {
        rotation: -16,
        y: 4,
        svgOrigin: "264 175",
        duration: 0.4,
      });
      gsap.to(this.q("#brow-right"), {
        rotation: 16,
        y: 4,
        svgOrigin: "336 175",
        duration: 0.4,
      });
      gsap.to(this.q("#pupils"), { y: 6, duration: 0.4 });
      gsap.to(this.q("#mustache"), {
        rotation: -5,
        y: 6,
        scaleX: 0.95,
        svgOrigin: "300 242",
        duration: 0.4,
      });

      gsap.to(this.q("#upper-body"), {
        y: 10,
        scaleY: 0.96,
        svgOrigin: "300 495",
        duration: 0.5,
      });
      gsap.to(this.q("#arm-right-wave"), {
        rotation: -38,
        y: 12,
        svgOrigin: "215 345",
        duration: 0.6,
        ease: "power2.out",
      });

      this.mainTimeline = gsap.timeline({ repeat: -1, yoyo: true });
      this.mainTimeline.fromTo(
        this.q("#head-group"),
        { rotation: -5, y: 12, svgOrigin: "300 310" },
        {
          rotation: 5,
          y: 12,
          svgOrigin: "300 310",
          duration: 0.85,
          ease: "sine.inOut",
        },
      );
    }

    this.onStateChange?.(stateName);
  }

  setTalking(forceState?: boolean): boolean {
    if (this.destroyed) return false;
    if (this.talkStopTimer) {
      clearTimeout(this.talkStopTimer);
      this.talkStopTimer = null;
    }
    this.talking = typeof forceState === "boolean" ? forceState : !this.talking;

    if (this.talking) {
      gsap.set(this.qAll(["#mouth-sad", "#mouth-thinking"]), { opacity: 0 });
      if (this.talkTimeline) this.talkTimeline.kill();

      this.talkTimeline = gsap.timeline({ repeat: -1 });
      this.talkTimeline
        .set(this.q("#mouth-open-smile"), {
          opacity: 1,
          scaleY: 1,
          svgOrigin: "300 255",
        })
        .set(this.q("#mouth-talk-closed"), { opacity: 0 })
        .to(this.q("#mustache"), {
          y: -3,
          rotation: 2,
          svgOrigin: "300 242",
          duration: 0.11,
        })
        .set(this.q("#mouth-open-smile"), { opacity: 0 }, "+=0.05")
        .set(this.q("#mouth-talk-closed"), { opacity: 1 })
        .to(this.q("#mustache"), {
          y: 1,
          rotation: -2,
          svgOrigin: "300 242",
          duration: 0.11,
        })
        .set(
          this.q("#mouth-open-smile"),
          { opacity: 1, scaleY: 1.22, svgOrigin: "300 255" },
          "+=0.04",
        )
        .set(this.q("#mouth-talk-closed"), { opacity: 0 })
        .to(this.q("#mustache"), {
          y: -4,
          rotation: 0,
          svgOrigin: "300 242",
          duration: 0.12,
        });
    } else {
      if (this.talkTimeline) {
        this.talkTimeline.kill();
        this.talkTimeline = null;
      }

      gsap.set(this.q("#mouth-talk-closed"), { opacity: 0 });
      gsap.to(this.q("#mustache"), { y: 0, rotation: 0, duration: 0.2 });

      if (this.currentState === "sad") {
        gsap.set(this.q("#mouth-open-smile"), { opacity: 0 });
        gsap.set(this.q("#mouth-sad"), { opacity: 1 });
      } else if (this.currentState === "thinking") {
        gsap.set(this.q("#mouth-open-smile"), { opacity: 0 });
        gsap.set(this.q("#mouth-thinking"), { opacity: 1 });
      } else {
        gsap.set(this.q("#mouth-open-smile"), { opacity: 1, scaleY: 1 });
      }
    }

    this.onTalkChange?.(this.talking);
    return this.talking;
  }

  speakFor(durationMs = 2200): void {
    if (this.destroyed) return;
    this.setTalking(true);
    this.talkStopTimer = setTimeout(() => {
      this.setTalking(false);
    }, durationMs);
  }

  triggerBlink(): void {
    if (this.destroyed || this.currentState === "excited") return;
    gsap
      .timeline()
      .set(this.q("#eyes-open"), { opacity: 0 })
      .set(this.q("#eyes-blink"), { opacity: 1 })
      .set(this.q("#eyes-open"), { opacity: 1 }, "+=0.14")
      .set(this.q("#eyes-blink"), { opacity: 0 });
  }

  setPivotsVisible(visible: boolean): void {
    gsap.to(this.q("#pivot-markers"), {
      opacity: visible ? 1 : 0,
      duration: 0.25,
    });
  }

  private scheduleRandomBlink(): void {
    if (this.destroyed) return;
    const nextDelay = 2800 + Math.random() * 2400;
    this.blinkTimer = setTimeout(() => {
      this.triggerBlink();
      this.scheduleRandomBlink();
    }, nextDelay);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    if (this.talkStopTimer) clearTimeout(this.talkStopTimer);
    this.mainTimeline?.kill();
    this.talkTimeline?.kill();
    gsap.killTweensOf(this.svg.querySelectorAll("*"));
  }
}
