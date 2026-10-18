import type { Condition, Ghost } from './domain';

export interface CharacterStoryText {
  readonly quote: string;
  readonly story?: string;
}

// Stable, zero-based portrait keys from assets.ts; never hash a request into a biography.
// The last four are reserved for future authored characters, not user-created requests.
export const portraitStories = {
  0: {
    quote: 'Весь мой багаж — одно письмо. Адрес на нём ещё можно дописать.',
    story:
      'В бюро принесли конверт без марки. Внутри оказалась аккуратно сложенная заявка и крошечный бумажный ключ.',
  },
  1: {
    quote: 'Закладку я захватил. Осталось найти место для следующей главы.',
    story:
      'К заявке приложена закладка с вышитой запятой. История явно собирается продолжаться, хотя последняя страница давно потерялась.',
  },
  2: {
    quote: 'У меня с собой карта. На ней пока только дорога сюда.',
    story:
      'Карта нарисована на обороте старой афиши. У двери бюро карандашная линия обрывается: следующий поворот ещё предстоит выбрать.',
  },
  3: {
    quote: 'Ключ пока оставлю на память. Вдруг он открывает что-то хорошее.',
    story:
      'Старый ключ перевязан театральной ленточкой. В описи багажа рядом с ним стоит единственное слово: «память».',
  },
  4: {
    quote: 'Бирку для чемодана я уже приготовил. Графа «адрес» пока пустая.',
    story:
      'В чемодане лежат три одинаковые бирки. На каждой выведено имя, а для нового адреса заботливо оставлено побольше места.',
  },
  5: {
    quote: 'Кажется, это мой номер в очереди. Я его больше не потеряю.',
    story:
      'Талон из бюро спрятан в медальон. Рядом лежит засушенный цветок, который пережил уже несколько переездов.',
  },
  6: {
    quote: 'У этой пуговицы длинная история. Расскажу, когда разберу вещи.',
    story:
      'В коробочке для мелочей хранится одна перламутровая пуговица. Остальной багаж всё ещё перечисляют на отдельном листке.',
  },
  7: {
    quote: 'Я принёс открытку для будущего адреса.',
    story:
      'На открытке нарисован мост, которого уже нет на городских картах. Оборот оставлен чистым — для новых вестей.',
  },
  8: {
    quote: 'Часы стоят, зато встречу в бюро я не пропустил.',
    story:
      'Карманные часы показывают без четверти переезд. Именно так подписан маленький рисунок на полях заявления.',
  },
  9: {
    quote: 'Лентой можно перевязать вещи. Или отметить начало новой истории.',
    story:
      'На папке с документами завязан необычно аккуратный бант. Развязывать его пока никто не решается.',
  },
} as const satisfies Record<number, CharacterStoryText>;

interface CharacterBinding {
  readonly id: string;
  readonly name: string;
  readonly portrait: keyof typeof portraitStories;
  readonly conditions: readonly Condition[];
  readonly text: CharacterStoryText;
}

// Match identity and the authored conditions, so editing a seed request cannot leave
// behind a quote about requirements that no longer belong to that request.
const characters: readonly CharacterBinding[] = [
  {
    id: 'g1',
    name: 'Агата Туманная',
    portrait: 0,
    conditions: ['attic', 'noMirrors'],
    text: portraitStories[0],
  },
  { id: 'g2', name: 'Феликс Шелест', portrait: 1, conditions: ['quiet'], text: portraitStories[1] },
  {
    id: 'g3',
    name: 'Марта Полуночная',
    portrait: 2,
    conditions: ['noPeople', 'damp'],
    text: portraitStories[2],
  },
  { id: 'g4', name: 'Леопольд Скрип', portrait: 3, conditions: ['dark'], text: portraitStories[3] },
  {
    id: 'g5',
    name: 'Эдгар Безадресный',
    portrait: 4,
    conditions: ['attic', 'damp', 'noPeople', 'quiet'],
    text: portraitStories[4],
  },
  {
    id: 'g6',
    name: 'Белла Опоздавшая',
    portrait: 5,
    conditions: ['noMirrors'],
    text: portraitStories[5],
  },
  {
    id: 'campaign-0',
    name: 'Нора Шёпот',
    portrait: 0,
    conditions: ['quiet'],
    text: {
      quote: 'Можно без фанфар? Мне нужна тишина.',
      story:
        'Нора принесла коробку писем, перевязанных ниткой. Все письма начинаются одинаково: «Когда обустроюсь, напишу».',
    },
  },
  {
    id: 'campaign-1',
    name: 'Оскар Тихий',
    portrait: 1,
    conditions: ['quiet'],
    text: {
      quote: 'В тихом доме я наконец дочитаю эту страницу.',
      story:
        'Оскар бережёт книгу без обложки. На полях он записывает адреса, где когда-нибудь надеется закончить чтение.',
    },
  },
  {
    id: 'campaign-2',
    name: 'Вера Сумеречная',
    portrait: 2,
    conditions: ['dark'],
    text: {
      quote: 'Мне бы темноту. Остальное расскажу за чашкой тумана.',
      story:
        'Вера собирает названия сумерек в маленький блокнот. Для нового дома там уже оставлена отдельная страница.',
    },
  },
  {
    id: 'campaign-3',
    name: 'Лев Полночный',
    portrait: 3,
    conditions: ['dark'],
    text: {
      quote: 'В темноте привычнее. Чемодан я и так узнаю на ощупь.',
      story:
        'На чемодане Льва сохранились наклейки давно закрытых станций. Самую новую наклейку он пока носит в кармане.',
    },
  },
  {
    id: 'campaign-4',
    name: 'Ирис Дождевая',
    portrait: 4,
    conditions: ['damp'],
    text: {
      quote: 'Люблю сырость. Сухой угол мне совсем не подойдёт.',
      story:
        'Ирис принесла баночку с надписью «Первый осенний дождь». Говорит, это семейный сувенир, а не часть залога.',
    },
  },
  {
    id: 'campaign-5',
    name: 'Фома Туманный',
    portrait: 5,
    conditions: ['damp'],
    text: {
      quote: 'Подыщите место посырее. Там моему туману уютнее.',
      story:
        'Фома хранит в папке рисунки облаков. Один лист оставлен пустым: на нём будет туман над новым адресом.',
    },
  },
];

export const neutralCharacterStory: CharacterStoryText = {
  quote: 'Пожелания к новому адресу указаны в заявке.',
};

export function getCharacterStory(ghost: Ghost): CharacterStoryText {
  const character = characters.find(
    (entry) =>
      entry.id === ghost.id &&
      entry.name === ghost.name &&
      (ghost.portrait ?? (entry.id.startsWith('g') ? entry.portrait : undefined)) ===
        entry.portrait &&
      entry.conditions.length === new Set(ghost.conditions).size &&
      entry.conditions.every((condition) => ghost.conditions.includes(condition)),
  );
  return character?.text ?? neutralCharacterStory;
}
