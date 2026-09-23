// Scroll mode: speed from the distance to the anchor, and its on-screen indicator –
// shared by the content script and the preview on the settings page.
var HoldToScroll = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
  const GAUGE_RADIUS = 90; // indicator radius at top speed (px, beyond the dead zone)

  // Neutral colors. "invert" draws white with mix-blend-mode: difference –
  // dark on light backgrounds, light on dark ones, so it stays visible everywhere.
  const PALETTES = {
    invert: { ink: "255, 255, 255", halo: null, blend: "difference" },
    dark: { ink: "0, 0, 0", halo: "255, 255, 255", blend: "normal" },
    light: { ink: "255, 255, 255", halo: "0, 0, 0", blend: "normal" },
  };
  const palette = (style) => PALETTES[style] ?? PALETTES.invert;

  // Steps: zone index for a distance; -1 = dead zone.
  // The last zone extends outwards without limit.
  function zoneAt(distance, s) {
    if (distance <= s.deadZone) return -1;
    return Math.min(Math.floor((distance - s.deadZone) / s.ringWidth), s.zoneSpeeds.length - 1);
  }

  // px/s for a distance to the anchor.
  // Progressive: base speed applies at 100 px beyond the dead zone, acceleration is the exponent.
  function speedAt(distance, s) {
    if (s.scrollMode === "steps") {
      const zone = zoneAt(distance, s);
      return zone < 0 ? 0 : s.zoneSpeeds[zone];
    }
    const beyond = distance - s.deadZone;
    if (beyond <= 0) return 0;
    return Math.min(s.scrollMax, s.scrollSpeed * (beyond / 100) ** s.scrollCurve);
  }

  function arrow(dx, dy) {
    return ARROWS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  }

  function node(name, attrs, parent) {
    const el = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent?.appendChild(el);
    return el;
  }

  function place(circles, x, y, r) {
    for (const c of circles) {
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", r);
    }
  }

  // Thin line with a contrasting casing (no casing in invert mode)
  function casedCircle(parent, colors, attrs) {
    const circles = [node("circle", { fill: "none", stroke: `rgba(${colors.ink}, 0.6)`, "stroke-width": "1", ...attrs }, parent)];
    if (colors.halo) {
      circles.unshift(node("circle", { fill: "none", stroke: `rgba(${colors.halo}, 0.35)`, "stroke-width": "3", ...attrs }, parent));
    }
    return circles;
  }

  function create(parent) {
    const svg = node("svg", { width: "100%", height: "100%" }, parent);
    svg.style.cssText = "display:block;overflow:visible;pointer-events:none";

    let gauge, limit, bands, activeBand, rings, dead, line, dot, badge;
    let built = "";
    const layoutKey = (s) => `${s.overlayStyle}:${s.scrollMode}:${s.zoneSpeeds.length}`;

    // Redraw when color style, variant or number of zones change
    function layout(s) {
      const colors = palette(s.overlayStyle);
      svg.replaceChildren();
      if (s.scrollMode === "steps") {
        // Every zone lightly filled, a little stronger outwards; the active zone stands out.
        // Boundaries between zones – the last zone is open outwards.
        bands = s.zoneSpeeds.map((_, i) =>
          node("circle", { fill: "none", stroke: `rgba(${colors.ink}, ${0.04 + 0.025 * i})` }, svg));
        activeBand = node("circle", { fill: "none", stroke: `rgba(${colors.ink}, 0.3)` }, svg);
        rings = s.zoneSpeeds.slice(0, -1).map(() => casedCircle(svg, colors, {}));
      } else {
        gauge = node("circle", { fill: `rgba(${colors.ink}, 0.22)` }, svg);
        if (colors.halo) gauge.setAttribute("stroke", `rgba(${colors.halo}, 0.25)`);
        limit = casedCircle(svg, colors, { "stroke-dasharray": "1 4", opacity: "0.6" });
      }
      dead = casedCircle(svg, colors, { "stroke-dasharray": "2 3" });
      line = node("line", { stroke: `rgba(${colors.ink}, 0.7)`, "stroke-width": "1.5", "stroke-linecap": "round" }, svg);
      dot = node("circle", { r: "3", fill: `rgba(${colors.ink}, 0.9)` }, svg);
      badge = node("text", {
        "font-family": "system-ui, sans-serif",
        "font-size": "12",
        "font-weight": "600",
        "dominant-baseline": "middle",
        "paint-order": "stroke",
        "stroke-linejoin": "round",
        fill: `rgb(${colors.ink})`,
        ...(colors.halo ? { stroke: `rgba(${colors.halo}, 0.7)`, "stroke-width": "3" } : {}),
      }, svg);
      built = layoutKey(s);
    }

    // anchor/mouse in parent coordinates; bounds = {width, height}
    function update(anchor, mouse, s, bounds) {
      if (built !== layoutKey(s)) layout(s);
      const dx = mouse.x - anchor.x;
      const dy = mouse.y - anchor.y;
      const distance = Math.hypot(dx, dy);
      const speed = speedAt(distance, s);

      if (s.scrollMode === "steps") {
        const zone = zoneAt(distance, s);
        bands.forEach((band, i) => {
          place([band], anchor.x, anchor.y, s.deadZone + s.ringWidth * (i + 0.5));
          band.setAttribute("stroke-width", s.ringWidth);
        });
        rings.forEach((ring, i) => place(ring, anchor.x, anchor.y, s.deadZone + s.ringWidth * (i + 1)));
        activeBand.style.display = zone < 0 ? "none" : "";
        place([activeBand], anchor.x, anchor.y, s.deadZone + s.ringWidth * (Math.max(zone, 0) + 0.5));
        activeBand.setAttribute("stroke-width", s.ringWidth);
      } else {
        // Area proportional to speed – the circle grows and shrinks with it
        const gaugeRadius = s.deadZone + GAUGE_RADIUS * Math.sqrt(speed / s.scrollMax);
        place([gauge], anchor.x, anchor.y, gaugeRadius);
        gauge.style.display = speed > 0 ? "" : "none";
        place(limit, anchor.x, anchor.y, s.deadZone + GAUGE_RADIUS);
      }
      place(dead, anchor.x, anchor.y, s.deadZone);
      dot.setAttribute("cx", anchor.x);
      dot.setAttribute("cy", anchor.y);

      line.setAttribute("x1", anchor.x);
      line.setAttribute("y1", anchor.y);
      line.setAttribute("x2", speed > 0 ? mouse.x : anchor.x);
      line.setAttribute("y2", speed > 0 ? mouse.y : anchor.y);

      badge.style.display = speed > 0 ? "" : "none";
      badge.textContent = speed > 0 ? `${arrow(dx, dy)} ${Math.round(speed)} px/s` : "";
      badge.setAttribute("x", Math.min(mouse.x + 14, bounds.width - 90));
      badge.setAttribute("y", Math.min(mouse.y + 20, bounds.height - 10));
    }

    return { element: svg, update };
  }

  return { speedAt, palette, create };
})();
