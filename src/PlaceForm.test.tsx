// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceForm from './PlaceForm';
afterEach(cleanup);
it('сохраняет нули, false и выбранное изображение из initialData', async () => {
  const add = vi.fn();
  const user = userEvent.setup();
  render(
    <PlaceForm
      onAdd={add}
      onCancel={() => {}}
      initialData={{
        name: 'Тихий адрес',
        description: 'Тест',
        temperature: 0,
        light: 0,
        noise: 0,
        humidity: 0,
        people: false,
        mirrors: false,
        attic: true,
        image: 'cellar',
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Добавить место' }));
  expect(add).toHaveBeenCalledWith(
    expect.objectContaining({
      temperature: 0,
      light: 0,
      noise: 0,
      humidity: 0,
      people: false,
      mirrors: false,
      attic: true,
      image: 'cellar',
      capacity: 1,
      maxAnxiety: 10,
    }),
  );
});
