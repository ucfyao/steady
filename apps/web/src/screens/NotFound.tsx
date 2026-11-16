import { StatusPage } from '../ui/StatusPage.js';

/** Any address the app does not know (Spec 004). */
export function NotFound() {
  return (
    <StatusPage
      title="Page not found"
      primary={{ label: 'Back to home', to: '/' }}
      secondary={{ label: 'See your progress', to: '/progress' }}
    >
      There is nothing at this address. It may have been typed wrong, or the link is out of date.
    </StatusPage>
  );
}
