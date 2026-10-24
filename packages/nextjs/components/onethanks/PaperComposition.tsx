/** A folded-paper still life, drawn as vectors so it stays crisp at every size. */
export const PaperComposition = () => (
  <div className="paper-composition" aria-hidden="true">
    <div className="art-background-word">Merci</div>
    <svg className="paper-sculpture" viewBox="0 0 560 440" fill="none">
      <defs>
        <linearGradient id="paper-fold" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop stopColor="#777e6e" />
          <stop offset=".46" stopColor="#e8e4d9" />
          <stop offset=".52" stopColor="#f5f1e7" />
          <stop offset="1" stopColor="#a3a897" />
        </linearGradient>
        <linearGradient id="envelope-paper" x1="90" y1="180" x2="310" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eeece2" />
          <stop offset="1" stopColor="#b9bcae" />
        </linearGradient>
        <radialGradient id="art-light">
          <stop stopColor="#53695b" />
          <stop offset="1" stopColor="#31463b" />
        </radialGradient>
      </defs>
      <path fill="url(#art-light)" d="M0 0h560v440H0z" />
      <ellipse cx="290" cy="399" rx="182" ry="19" fill="#19291f" opacity=".5" />
      <g transform="translate(316 207) rotate(-18)">
        {Array.from({ length: 44 }, (_, index) => (
          <path
            key={index}
            d="M0 0 Q-33-53-18-145 Q0-166 18-145 Q33-53 0 0Z"
            fill="url(#paper-fold)"
            transform={`rotate(${index * (360 / 44)})`}
          />
        ))}
        <circle r="12" fill="#dedfd1" />
      </g>
      <g transform="rotate(-12 212 305)">
        <path d="M83 232h251v152H83z" fill="#15271e" opacity=".25" transform="translate(7 10)" />
        <path d="M83 232h251v152H83z" fill="url(#envelope-paper)" />
        <path d="m83 232 126 103 125-103" fill="#e2e0d5" />
        <path d="m83 384 113-89m138 89-113-89" stroke="#a8ad9e" strokeWidth=".8" />
        <path d="m83 232 126 103 125-103" stroke="#b4b8a9" strokeWidth=".8" />
        <circle cx="209" cy="330" r="20" fill="#e84600" />
        <path d="m200 330 6 6 12-13" stroke="#ece5d5" strokeWidth="1.5" />
      </g>
      <text x="32" y="40" fill="#c6cbbd" fontFamily="Georgia, serif" fontSize="13" fontStyle="italic">
        For the people behind the code.
      </text>
      <text x="520" y="414" fill="#c6cbbd" fontFamily="Georgia, serif" fontSize="13" textAnchor="end">
        OneThanks — correspondence
      </text>
    </svg>
    <div className="art-story-band">
      <span>
        Good code.
        <br />
        Kind words.
        <br />A little gratitude.
      </span>
      <span className="art-asterisk">✳</span>
    </div>
    <div className="art-caption">把屏幕这端的感谢，寄到另一端。</div>
  </div>
);
