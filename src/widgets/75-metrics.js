/* Chapter 75: "Can you explain the drop?" Which root causes your logging can confirm or rule out. */
G.widget('w-mt-explain', function (root) {
  var FIELDS = [
    ['model', 'Model version'], ['prompt', 'Prompt version'], ['exposure', 'Exposure'], ['client', 'Client version'],
    ['region', 'Region'], ['latency', 'Latency'], ['errors', 'Error codes'], ['trace', 'Trace IDs']
  ];
  var NAME = {}; FIELDS.forEach(function (f) { NAME[f[0]] = f[1]; });
  var PRESETS = { bare: [], dash: ['model', 'region', 'latency'], full: FIELDS.map(function (f) { return f[0]; }) };
  var CAUSES = [
    { t: 'v7 writes worse answers', need: ['model', 'trace'], ev: 'Joining traces to judge-graded outputs: completed v7 answers score 1.2 points higher than v6 on every client.' },
    { t: 'A prompt-template change shipped the same week', need: ['prompt'], ev: 'Prompt version p-41 on both arms all week. Nothing changed.' },
    { t: 'The drop comes from users assigned to v7 who never saw it', need: ['exposure'], ev: '97% of assigned users were exposed in both arms, and the drop sits entirely among exposed users.' },
    { t: 'A logging bug loses feedback events in treatment', need: ['exposure', 'trace'], ev: 'Exposed counts match the 50/50 split (SRM p = 0.41), and 99.8% of traces carry their feedback event in both arms.' },
    { t: 'Fewer people rate, and the ones who do are grumpier', need: ['exposure'], ev: 'Ratings per exposed user are unchanged at 12% in both arms, so the raters are the same mix.' },
    { t: 'A regional outage in one data center', need: ['region', 'errors'], ev: 'Server error rates are flat in every region, and the drop is about the same size in EU, US and APAC.' },
    { t: 'v7 is slower everywhere, so people give up before rating', need: ['latency', 'client'], ev: 'Median latency is up 0.3 s on every client, but the drop is concentrated in one client, so general slowness does not explain it.' },
    { t: 'The old Android app (5.2) times out on v7’s longer answers', need: ['client', 'latency', 'errors'], truth: true, ev: '92% of the drop is on Android 5.2. Its 10 s client timeout fires on 18% of v7 responses (CLIENT_TIMEOUT) against 2% for v6, because v7 answers run 40% longer.' },
    { t: 'A seasonal dip that hit everyone that week', need: ['model'], ev: 'Events tagged with v6 stay flat at 71% over the same days, so the dip is specific to v7.' }
  ];
  var on = {}, chipBox = G.$(root, '[data-fields]'), list = G.$(root, '[data-list]'), pre = G.$$(root, '[data-preset]');
  FIELDS.forEach(function (f) {
    var b = document.createElement('button'); b.className = 'b'; b.type = 'button'; b.dataset.f = f[0]; b.textContent = f[1];
    b.setAttribute('aria-pressed', 'false'); chipBox.appendChild(b);
    G.on(b, 'click', function () { on[f[0]] = !on[f[0]]; pre.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); }); draw(); });
  });
  function setPreset(k) { on = {}; PRESETS[k].forEach(function (f) { on[f] = true; }); pre.forEach(function (p) { p.setAttribute('aria-pressed', p.dataset.preset === k ? 'true' : 'false'); }); }
  pre.forEach(function (p) { G.on(p, 'click', function () { setPreset(p.dataset.preset); draw(); }); });
  setPreset('dash');
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function draw() {
    G.$$(chipBox, 'button').forEach(function (b) { b.setAttribute('aria-pressed', on[b.dataset.f] ? 'true' : 'false'); });
    var n = { yes: 0, no: 0, unk: 0 }, html = '', truthKnown = false, unkNames = [];
    CAUSES.forEach(function (c) {
      var miss = c.need.filter(function (f) { return !on[f]; }), st, pill, body;
      if (miss.length) { st = 'unk'; pill = 'Unknowable'; body = 'Needs ' + c.need.map(function (f) { return NAME[f]; }).join(' + ') + '. Missing: <b>' + miss.map(function (f) { return NAME[f]; }).join(', ') + '</b>.'; unkNames.push(c.t); }
      else if (c.truth) { st = 'yes'; pill = 'Confirmed'; body = esc(c.ev); truthKnown = true; }
      else { st = 'no'; pill = 'Ruled out'; body = esc(c.ev); }
      n[st]++;
      html += '<div class="mt-row ' + st + '"><div><span class="pill">' + pill + '</span></div><div><div class="t">' + esc(c.t) + '</div><div class="e">' + body + '</div></div></div>';
    });
    list.innerHTML = html;
    G.$(root, '[data-c-yes]').textContent = G.fmt(n.yes, 0);
    G.$(root, '[data-c-no]').textContent = G.fmt(n.no, 0);
    G.$(root, '[data-c-unk]').textContent = G.fmt(n.unk, 0);
    var cnt = Object.keys(on).filter(function (k) { return on[k]; }).length, msg;
    if (truthKnown && n.unk === 0) msg = 'Every candidate is resolved with ' + G.fmt(cnt, 0) + ' fields. The model is better; an old client truncates its longer answers. Fix the client timeout or stream responses, keep v7, and add client timeout rate as a guardrail.';
    else if (truthKnown) msg = 'You found the cause: the old Android client’s timeout. ' + G.fmt(n.unk, 0) + ' other explanation' + (n.unk === 1 ? '' : 's') + ' cannot be ruled out yet, so expect someone in the review to ask about ' + (n.unk === 1 ? 'it' : 'them') + '.';
    else if (cnt === 0) msg = 'With only timestamps and the metric, all nine stories fit the data. The review becomes a debate, and the likely outcome is a rollback of a model that is actually better.';
    else msg = 'The true cause stays hidden. ' + G.fmt(n.unk, 0) + ' candidates are unknowable with these fields. Think about which fields would show where the drop happens and what failed there, then which ones rule out the other stories.';
    G.$(root, '[data-out]').textContent = msg;
  }
  return draw;
});
