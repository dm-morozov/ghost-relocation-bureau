// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterStory from './CharacterStory';
import { getCharacterStory, neutralCharacterStory, portraitStories } from './character-stories';
import { demoGhosts } from './data';
import { arrivals } from './game';
import { ghostPortraits, portraitUrl } from './assets';

afterEach(cleanup);
const demos = demoGhosts('2026-10-18');

describe('stable character stories', () => {
  it('keeps ten explicit portrait entries without assigning them to user requests', () => {
    expect(Object.keys(portraitStories)).toEqual(ghostPortraits.map((_, i) => String(i)));
    ghostPortraits.forEach((_, portrait) => {
      expect(portraitStories[portrait as keyof typeof portraitStories].story).toBeTruthy();
      expect(getCharacterStory({ ...demos[0], id: 'custom', portrait })).toBe(
        neutralCharacterStory,
      );
    });
  });

  it.each([...demos, ...arrivals])('has a story for $name regardless of array order', (ghost) => {
    const text = getCharacterStory(ghost);
    expect(text.story).toBeTruthy();
    expect(text).not.toBe(neutralCharacterStory);
    expect(getCharacterStory({ ...ghost, conditions: [...ghost.conditions].reverse() })).toBe(text);
    expect(portraitUrl(ghost)).toContain(
      `ghost-0${(ghost.portrait ?? Number(ghost.id.slice(1)) - 1) + 1}`,
    );
  });

  it('requires the original id, name, portrait and conditions, not just a familiar image', () => {
    for (const ghost of [...demos, ...arrivals]) {
      expect(getCharacterStory({ ...ghost, name: 'Другая заявка' })).toBe(neutralCharacterStory);
      expect(getCharacterStory({ ...ghost, id: 'user-request' })).toBe(neutralCharacterStory);
      expect(getCharacterStory({ ...ghost, portrait: 9 })).toBe(neutralCharacterStory);
      expect(getCharacterStory({ ...ghost, conditions: [] })).toBe(neutralCharacterStory);
    }
    expect(getCharacterStory({ ...demos[0], conditions: ['quiet'] })).toBe(neutralCharacterStory);
    expect(getCharacterStory({ ...demos[1], conditions: ['quiet', 'dark'] })).toBe(
      neutralCharacterStory,
    );
  });

  it('keeps biographies separate from deadlines, temperature and allocation', () => {
    const ghost = demos[0];
    const before = structuredClone(ghost);
    const text = getCharacterStory(ghost);
    expect(
      getCharacterStory({ ...ghost, deadline: '2099-01-01', temperature: 25, anxiety: 1 }),
    ).toBe(text);
    expect(ghost).toEqual(before);
  });
});

it('renders a quote and a keyboard-focusable native disclosure without stealing focus', async () => {
  const user = userEvent.setup();
  const { container } = render(<CharacterStory ghost={arrivals[0]} />);
  expect(screen.getByRole('blockquote', { name: 'Реплика: Нора Шёпот' })).toBeTruthy();
  const summary = screen.getByText('Маленькая история', { exact: false });
  const details = container.querySelector('details')!;
  expect(details.open).toBe(false);
  await user.tab();
  expect(document.activeElement).toBe(summary);
  // jsdom does not implement Enter/Space default activation for native summary.
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  fireEvent.click(summary);
  expect(details.open).toBe(false);
});

it('closes the previous disclosure when the selected character changes', () => {
  const { container, rerender } = render(<CharacterStory ghost={demos[0]} />);
  fireEvent.click(container.querySelector('summary')!);
  expect(container.querySelector('details')!.open).toBe(true);
  rerender(<CharacterStory ghost={demos[1]} />);
  expect(container.querySelector('details')!.open).toBe(false);
  expect(screen.getByText(getCharacterStory(demos[1]).quote)).toBeTruthy();
});

it('renders a neutral quote without a broken disclosure when a biography is missing', () => {
  const { container } = render(<CharacterStory ghost={{ ...demos[0], id: 'new' }} />);
  expect(screen.getByText(neutralCharacterStory.quote)).toBeTruthy();
  expect(container.querySelector('details')).toBeNull();
});
