// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceForm from './PlaceForm';
import { places } from './data';
import { locationCatalog } from './assets';
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
it('предлагает только свободные локации, связывает название с изображением и исключает сохранённую', async () => {
  const user = userEvent.setup(),
    add = vi.fn();
  const { rerender } = render(
    <PlaceForm onAdd={add} onCancel={() => {}} existingPlaces={places} />,
  );
  expect(screen.getAllByRole('radio')).toHaveLength(5);
  expect(screen.queryByRole('radio', { name: 'Замок на холме' })).toBeNull();
  await user.click(screen.getByRole('radio', { name: 'Часовая башня' }));
  const name = screen.getByLabelText('Название') as HTMLInputElement;
  expect(name.value).toBe('Часовая башня');
  expect(name.readOnly).toBe(true);
  await user.type(screen.getByLabelText('Описание'), 'Тихая башня');
  await user.click(screen.getByRole('button', { name: 'Добавить место' }));
  const saved = add.mock.calls[0][0];
  expect(saved).toMatchObject({ name: 'Часовая башня', image: 'clocktower' });
  rerender(<PlaceForm onAdd={add} onCancel={() => {}} existingPlaces={[...places, saved]} />);
  expect(screen.getAllByRole('radio')).toHaveLength(4);
  expect(screen.queryByRole('radio', { name: 'Часовая башня' })).toBeNull();
});
it('объясняет исчерпанный каталог и не позволяет создать дубликат', () => {
  render(
    <PlaceForm
      onAdd={vi.fn()}
      onCancel={() => {}}
      existingPlaces={locationCatalog.map((l, i) => ({
        ...places[0],
        id: String(i),
        name: l.name,
        image: l.image,
      }))}
    />,
  );
  expect(screen.getByText('Все локации уже добавлены')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Добавить место' })).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
});
