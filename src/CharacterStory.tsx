import type { Ghost } from './domain';
import { getCharacterStory } from './character-stories';
import './character-stories.css';

export default function CharacterStory({ ghost }: { ghost: Ghost }) {
  const text = getCharacterStory(ghost);
  return (
    <div className="character-story">
      <blockquote aria-label={`Реплика: ${ghost.name}`}>{text.quote}</blockquote>
      {text.story && (
        <details key={`${ghost.id}:${text.story}`}>
          <summary>
            Маленькая история <span className="character-story-name">— {ghost.name}</span>
          </summary>
          <p>{text.story}</p>
        </details>
      )}
    </div>
  );
}
