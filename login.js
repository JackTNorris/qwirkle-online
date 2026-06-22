const inputs = [0,1,2,3].map(i => document.getElementById('c'+i));
const btn = document.getElementById('join-btn');
const err = document.getElementById('err');

inputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/[^a-zA-Z0-9]/g,'').slice(-1).toUpperCase();
    if (inp.value && i < 3) inputs[i+1].focus();
    err.textContent = '';
    btn.disabled = inputs.some(x => !x.value);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i-1].focus();
  });
  inp.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
    text.split('').forEach((ch, j) => { if (inputs[j]) inputs[j].value = ch; });
    const next = Math.min(text.length, 3);
    inputs[next].focus();
    btn.disabled = inputs.some(x => !x.value);
  });
});

function handleJoin() {
  const code = inputs.map(x => x.value).join('');
  if (code.length < 4) { err.textContent = 'Please enter all 4 characters.'; return; }
  sendPrompt('Player joining Qwirkle room: ' + code);
}