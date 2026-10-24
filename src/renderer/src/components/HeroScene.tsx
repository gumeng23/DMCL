export function HeroScene(): JSX.Element {
  return (
    <svg
      className="hero-scene"
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#143f39" />
          <stop offset=".48" stopColor="#2f7359" />
          <stop offset=".78" stopColor="#8fae6b" />
          <stop offset="1" stopColor="#e3c17d" />
        </linearGradient>
        <radialGradient id="heroSun" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fdffcf" />
          <stop offset=".36" stopColor="#f6eaa0" />
          <stop offset=".72" stopColor="#eec878" stopOpacity=".75" />
          <stop offset="1" stopColor="#e9b76e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heroHalo" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#f4f1ac" stopOpacity=".5" />
          <stop offset="1" stopColor="#f4f1ac" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="farMountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#477a5e" />
          <stop offset="1" stopColor="#224839" />
        </linearGradient>
        <linearGradient id="midMountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f624b" />
          <stop offset="1" stopColor="#173a2e" />
        </linearGradient>
        <linearGradient id="heroWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f9179" />
          <stop offset=".55" stopColor="#285d50" />
          <stop offset="1" stopColor="#123c36" />
        </linearGradient>
        <linearGradient id="grassFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d6e3d" />
          <stop offset=".18" stopColor="#2b5532" />
          <stop offset="1" stopColor="#132d22" />
        </linearGradient>
        <linearGradient id="heroFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#08110d" stopOpacity=".96" />
          <stop offset=".42" stopColor="#08110d" stopOpacity=".5" />
          <stop offset=".75" stopColor="#08110d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cubeGlow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#b8ff6d" stopOpacity=".38" />
          <stop offset="1" stopColor="#b8ff6d" stopOpacity="0" />
        </radialGradient>
        <filter id="sunBlur" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="19" />
        </filter>
        <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="1000" height="560" fill="url(#heroSky)" />
      <g opacity=".8">
        <circle cx="772" cy="154" r="210" fill="url(#heroHalo)" />
        <circle cx="772" cy="154" r="118" fill="url(#heroSun)" filter="url(#sunBlur)" />
        <rect x="755" y="137" width="34" height="34" fill="#fdf9c9" opacity=".9" />
        <rect x="789" y="171" width="18" height="18" fill="#fdf9c9" opacity=".65" />
        <rect x="737" y="171" width="18" height="18" fill="#fdf9c9" opacity=".5" />
      </g>

      <g className="hero-clouds" fill="#d9e7c4" opacity=".17">
        <g>
          <rect x="118" y="92" width="112" height="13" />
          <rect x="146" y="79" width="70" height="13" />
          <rect x="204" y="66" width="42" height="13" />
          <rect x="190" y="105" width="78" height="12" />
        </g>
        <g opacity=".7">
          <rect x="530" y="65" width="86" height="11" />
          <rect x="558" y="54" width="48" height="11" />
          <rect x="588" y="76" width="62" height="10" />
        </g>
        <g opacity=".5">
          <rect x="796" y="252" width="96" height="10" />
          <rect x="834" y="242" width="44" height="10" />
        </g>
      </g>

      <g opacity=".75">
        <path
          d="M0 348V294h46v-24h37v-26h48v-25h52v20h37v34h55v-18h45v-30h61v41h49v28h51v-22h62v-34h52v49h61v27h53v-37h57v44h61v25h58v-31h71v53h34v46H0Z"
          fill="url(#farMountain)"
        />
        <path
          d="M0 348V294h46v-24h37v-26h48v-25h52v20h37v34h55v-18h45v-30h61v41h49v28h51v-22h62v-34h52v49h61v27h53v-37h57v44h61v25h58v-31h71v53h34"
          fill="none"
          stroke="#8ab879"
          strokeOpacity=".25"
          strokeWidth="2"
        />
      </g>

      <g opacity=".55" fill="#bcd99c">
        <rect x="320" y="220" width="22" height="4" />
        <rect x="356" y="248" width="34" height="4" />
        <rect x="620" y="206" width="28" height="4" />
        <rect x="664" y="234" width="16" height="4" />
      </g>

      <path
        d="M0 430v-38h58v-31h47v-34h66v17h55v36h62v-24h58v-32h74v47h46v-19h66v35h81v-40h68v29h55v-33h73v49h58v-24h80v43h53v60H0Z"
        fill="url(#midMountain)"
      />
      <path
        d="M0 392h58v-31h47v-34h66v17h55v36h62v-24h58v-32h74v47h46v-19h66v35h81v-40h68v29h55v-33h73v49h58v-24h80v43"
        fill="none"
        stroke="#6d9d6b"
        strokeOpacity=".2"
        strokeWidth="2"
      />

      <g opacity=".6" fill="#173f34">
        <rect x="0" y="423" width="78" height="57" />
        <rect x="78" y="438" width="44" height="42" />
        <rect x="650" y="412" width="90" height="58" />
        <rect x="740" y="430" width="50" height="40" />
      </g>

      <g className="hero-cube cube-a">
        <circle cx="680" cy="164" r="88" fill="url(#cubeGlow)" />
        <path d="M680 105 726 131 680 157 634 131Z" fill="#b8f27d" />
        <path d="M634 131 680 157v47l-46-26v-47Z" fill="#578e41" />
        <path d="M726 131 680 157v47l46-26v-47Z" fill="#7dbb51" />
        <path d="M647 135 668 147v14l-21-12v-14Z" fill="#e1ffb0" opacity=".55" />
      </g>
      <g className="hero-cube cube-b">
        <circle cx="844" cy="316" r="62" fill="url(#cubeGlow)" opacity=".6" />
        <path d="M842 276 877 296 842 316 807 296Z" fill="#9ad3e2" opacity=".85" />
        <path d="M807 296 842 316v35l-35-20v-35Z" fill="#3c6f78" />
        <path d="M877 296 842 316v35l35-20v-35Z" fill="#5c949d" />
      </g>

      <g>
        <path
          d="M0 466v-28h90v-10h119v-20h84v12h105v-16h118v8h134v-18h113v14h121v17h116v55H0Z"
          fill="url(#heroWater)"
        />
        <g opacity=".2" fill="#c9f0be">
          <rect x="93" y="454" width="114" height="3" />
          <rect x="239" y="482" width="156" height="3" />
          <rect x="483" y="451" width="116" height="3" />
          <rect x="636" y="491" width="180" height="3" />
          <rect x="795" y="458" width="92" height="3" />
        </g>
        <g opacity=".12" fill="#fbf5c9">
          <rect x="740" y="460" width="4" height="42" />
          <rect x="753" y="480" width="8" height="3" />
          <rect x="768" y="470" width="5" height="38" />
          <rect x="732" y="502" width="51" height="3" />
        </g>
      </g>

      <g>
        <path
          d="M0 560V500h78v-18h82v-13h93v10h100v18h84v-12h110v22h104v-18h108v17h141v-16h100v28h-1000Z"
          fill="url(#grassFace)"
        />
        <path
          d="M0 500h78v-18h82v-13h93v10h100v18h84v-12h110v22h104v-18h108v17h141v-16h100v9l-100 6-140-4-108 10-104-8-110 5-84-7-100 5-93-6-82 7H0Z"
          fill="#5f9550"
        />
        <g fill="#9dd374" opacity=".6">
          <rect x="40" y="493" width="7" height="9" />
          <rect x="116" y="480" width="8" height="10" />
          <rect x="223" y="482" width="7" height="10" />
          <rect x="350" y="491" width="8" height="9" />
          <rect x="462" y="486" width="7" height="11" />
          <rect x="583" y="499" width="7" height="9" />
          <rect x="700" y="481" width="8" height="10" />
          <rect x="822" y="486" width="7" height="10" />
          <rect x="929" y="497" width="8" height="9" />
        </g>
      </g>

      <g className="hero-trees">
        <g transform="translate(704 350)">
          <rect x="28" y="80" width="17" height="77" fill="#4a3423" />
          <rect x="28" y="80" width="8" height="77" fill="#38271a" />
          <g fill="#214f38">
            <rect x="0" y="58" width="74" height="24" />
            <rect x="9" y="40" width="56" height="23" />
            <rect x="18" y="22" width="39" height="22" />
            <rect x="28" y="6" width="20" height="22" />
          </g>
          <g fill="#3f7c4f">
            <rect x="0" y="58" width="74" height="8" />
            <rect x="9" y="40" width="56" height="7" />
            <rect x="18" y="22" width="39" height="7" />
            <rect x="28" y="6" width="20" height="6" />
            <rect x="18" y="22" width="8" height="17" />
            <rect x="41" y="40" width="8" height="18" />
          </g>
          <g fill="#8bc463" opacity=".55">
            <rect x="3" y="60" width="10" height="4" />
            <rect x="22" y="42" width="9" height="4" />
            <rect x="48" y="24" width="8" height="4" />
          </g>
        </g>
        <g transform="translate(826 379) scale(.72)">
          <rect x="26" y="70" width="14" height="68" fill="#42301f" />
          <g fill="#1c4332">
            <rect x="0" y="48" width="66" height="26" />
            <rect x="8" y="31" width="50" height="20" />
            <rect x="17" y="14" width="32" height="20" />
            <rect x="25" y="0" width="17" height="19" />
          </g>
          <g fill="#3a7048">
            <rect x="0" y="48" width="66" height="8" />
            <rect x="8" y="31" width="50" height="7" />
            <rect x="17" y="14" width="32" height="7" />
            <rect x="25" y="0" width="17" height="6" />
          </g>
        </g>
      </g>

      <g className="hero-fireflies" fill="#dcff9a">
        <circle cx="588" cy="277" r="2.6" opacity=".9" />
        <circle cx="612" cy="316" r="1.8" opacity=".55" />
        <circle cx="926" cy="238" r="2.3" opacity=".7" />
        <circle cx="882" cy="391" r="1.9" opacity=".6" />
        <circle cx="654" cy="246" r="1.5" opacity=".6" />
        <circle cx="963" cy="338" r="2.4" opacity=".5" />
        <circle cx="542" cy="238" r="1.7" opacity=".4" />
      </g>

      <rect width="1000" height="560" fill="url(#heroFade)" />
      <rect width="1000" height="560" fill="#06110d" opacity=".08" />
    </svg>
  )
}
