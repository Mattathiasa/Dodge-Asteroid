import type { SkinId } from '../game/unlocks.js';
import { DEFAULT_SKIN, SKINS } from '../game/unlocks.js';
import { swatchFor } from '../render/skins.js';

/**
 * The ship finish picker: real radio buttons, so it works by keyboard and
 * reads properly aloud. A locked finish says what earns it.
 */
export function renderHangar(
  container: HTMLElement,
  owned: readonly SkinId[],
  selected: SkinId,
  onChoose: (id: SkinId) => void,
): void {
  container.textContent = '';
  for (const skin of SKINS) {
    const unlocked = skin.id === DEFAULT_SKIN || owned.includes(skin.id);

    const label = document.createElement('label');
    label.className = 'hangar__option';
    label.classList.toggle('is-locked', !unlocked);

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'ship-skin';
    input.value = skin.id;
    input.checked = skin.id === selected;
    input.disabled = !unlocked;
    input.addEventListener('change', () => {
      if (input.checked) onChoose(skin.id);
    });

    const swatch = document.createElement('span');
    swatch.className = 'hangar__swatch';
    swatch.style.background = swatchFor(skin.id);
    swatch.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'hangar__name';
    name.textContent = skin.name;

    label.append(input, swatch, name);
    if (!unlocked) {
      const requirement = document.createElement('span');
      requirement.className = 'hangar__requirement';
      requirement.textContent = skin.requirement;
      label.append(requirement);
    }
    container.append(label);
  }
}
