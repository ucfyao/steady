import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChipGroup } from '../../src/ui/ChipGroup.js';

const OPTIONS = [
  { value: 'poor', label: 'Poor' },
  { value: 'ok', label: 'OK' },
  { value: 'good', label: 'Good' },
] as const;

function Sleep({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<string>('ok');
  return (
    <>
      <button type="button">Before</button>
      <ChipGroup
        legend="How did you sleep?"
        name="sleep"
        options={OPTIONS}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </>
  );
}

describe('ChipGroup', () => {
  it('is a labelled group of native radios with the current value checked', () => {
    render(<Sleep />);
    const group = screen.getByRole('group', { name: 'How did you sleep?' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'OK' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Poor' })).not.toBeChecked();
  });

  it('selects a chip on click and reports the value', async () => {
    const onChange = vi.fn();
    render(<Sleep onChange={onChange} />);
    await userEvent.click(screen.getByText('Good'));
    expect(onChange).toHaveBeenCalledWith('good');
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'OK' })).not.toBeChecked();
  });

  it('works from the keyboard: Tab reaches the checked chip, arrows move the selection', async () => {
    const onChange = vi.fn();
    render(<Sleep onChange={onChange} />);
    screen.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'OK' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Good' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('good');

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Poor' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('poor');
  });
});
