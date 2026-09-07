// Authored fiction, entirely local. No model, score or network request.
const endings = {
  pause: {
    title: 'The doors open. The queue gets longer.',
    text: 'Mara asks the city to pause automated job rejections while people examine the rules. Some workers finally get an interview. Applications pile up; the city let the old hiring teams go years ago. She writes a second demand: pay people to do the work. An off switch can stop a bad decision. It cannot replace the staff who once made it.',
  },
  appeal: {
    title: 'A person gets time to listen.',
    text: 'Mara asks for paid reviewers who can read the original evidence and overturn a result. Her missed bus enters the record. Her case changes. Thousands of people still have no time to file an appeal, so she asks who will find them. A right that only the persistent can use leaves the quietest people waiting.',
  },
  measure: {
    title: 'The average loses its hiding place.',
    text: 'Mara asks the city to publish the longest journeys, unresolved complaints and overturned decisions, not just the happy averages. The contract begins paying for verified repairs instead of closed cases. The company proposes a new satisfaction score. She circles the word “verified” and asks who gets to check. Changing the target helps. Giving affected people a say in the target matters too.',
  },
};
const choices = document.querySelectorAll('[data-story-choice]');
for (const button of choices) button.addEventListener('click', () => {
  const ending = endings[button.dataset.storyChoice];
  if (!ending) return;
  for (const choice of choices) choice.setAttribute('aria-pressed', String(choice === button));
  document.getElementById('story-outcome-title').textContent = ending.title;
  document.getElementById('story-outcome-text').textContent = ending.text;
});
