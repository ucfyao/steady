import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../src/ui/Button.js';

describe('Button', () => {
  it('is a native button of type "button" by default', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a router link when given "to"', () => {
    render(
      <MemoryRouter>
        <Button to="/play" variant="primary">
          Start
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/play');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
