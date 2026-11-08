/* ==========================================================================
   EDIT YOUR STORY HERE.
   Everything on the journey page comes from this file. Replace anything in
   [brackets]. Add or remove highlights freely — each one is { date, title,
   text } plus optional  image: 'assets/photos/file.jpg'  and  link: 'https://...'
   ========================================================================== */
window.JOURNEY = {
  stops: [
    {
      id: 'iowa',
      num: '01',
      place: 'Iowa',
      where: 'Shueyville, just outside Cedar Rapids',
      years: '2004 – 2015',
      coords: [41.8517, -91.5579],
      zoom: 12,
      color: '#2E7D46',
      blurb: '[One or two sentences about growing up in Shueyville: family, first interests, what shaped you.]',
      intro: '[Optional: a slightly longer intro for the highlights panel.]',
      highlights: [
        { date: '[Year]', title: '[Highlight title]', text: '[A few sentences: what you did, why it mattered, what you learned.]' },
        { date: '[Year]', title: '[Highlight title]', text: '[A few sentences: what you did, why it mattered, what you learned.]' },
        { date: '[Year]', title: '[Highlight title]', text: '[A few sentences: what you did, why it mattered, what you learned.]' }
      ]
    },
    {
      id: 'austin',
      num: '02',
      place: 'Austin',
      where: 'River Place, near Four Points',
      years: 'Summer 2015 – 2023',
      coords: [30.3905, -97.8555],
      zoom: 12.5,
      color: '#D9481F',
      blurb: '[One sentence about growing up in Austin.] Still home base: I\'ve spent my college summers back here working in finance.',
      intro: 'Where I grew up, and where I came back to for my first finance internships.',
      highlights: [
        { date: '[Years]', title: '[High school highlight]', text: '[A few sentences: sports, activities, what you were known for.]' },
        { date: 'Summer 2025', title: 'Financial/AI Analyst · Prophet Capital Asset Management', text: 'Set up Microsoft Copilot to cross-check pitch book analytics against Limited Partnership Agreements, cutting manual review time by more than 50%. Led the firm\'s first company-wide Copilot demo, showing how AI could help the team work through legal documents and financials.' },
        { date: 'Summer 2026', title: 'Acquisition Intern · Altus Equity Group', text: 'Underwrote 55+ deals averaging $25M, working through cash flows, cap rates, DSCR, and levered IRR. Worked with senior leadership on deal strategy and managed broker communications across the active pipeline.' }
      ]
    },
    {
      id: 'waco',
      num: '03',
      place: 'Waco',
      where: 'Baylor University',
      years: 'Summer 2023 – May 2027',
      coords: [31.5489, -97.1143],
      zoom: 14.5,
      color: '#0E7C72',
      blurb: 'Studying Finance at Baylor\'s Hankamer School of Business, and getting real deal experience along the way: angel investing, a student-run fund, and private equity.',
      intro: 'BBA in Finance, 3.92 GPA. Most of what I\'ve learned about investing started here.',
      highlights: [
        { date: '2023 – 2027', title: 'BBA in Finance · Baylor University', text: 'Hankamer School of Business, 3.92 GPA. Dean\'s Academic Honors List five semesters. Baylor Distinction Award and Achievement Baylor Scholarship.' },
        { date: 'Oct 2025 – Mar 2026', title: 'Junior Analyst · Baylor Angel Network', text: 'Ran due diligence on two startups for the investment committee: their markets, financials, and risks. Worked with a senior analyst and angel mentors, then met founders and investors at Presentation Day.' },
        { date: 'Nov 2025 – May 2026', title: 'Member Educator · Sigma Alpha Epsilon', text: 'Taught 34 new members the chapter\'s history, values, and standards, and organized three cross-chapter mixers to build their professional communication skills.' },
        { date: 'Jan – May 2026', title: 'Equity Research · Hodges Fund', text: 'One of 15 students selected for the Industrials, Materials & Energy house of Baylor\'s $1.8M student-managed fund. Pitched an investment thesis to the faculty advisor and peer analysts; it was added to the portfolio as a position of more than $75,000.' },
        { date: 'Aug 2026 – Spring 2027', title: 'Private Equity Intern · Oakdale Capital', text: 'Due diligence on a pre-revenue growth-equity deal: modeling the key business drivers, joining banker calls, and preparing questions for founders. I also sit in on pipeline meetings with new companies, and I\'ll be working there full time in spring 2027.' },
        { date: '2026 – 2027', title: 'Sing Chairman', text: '[What Sing is and what you led.]' }
      ]
    },
    {
      id: 'houston',
      num: '04',
      place: 'Houston',
      where: 'Downtown',
      years: 'June 2027 –',
      coords: [29.7589, -95.3677],
      zoom: 14,
      color: '#2860C4',
      blurb: 'Next stop: downtown Houston, as a Syndication & Leverage Finance Analyst at Zions Capital Markets.',
      intro: 'The next chapter, and the reason the map ends downtown.',
      highlights: [
        { date: '2027', title: 'Syndication & Leverage Finance Analyst · Zions Capital Markets', text: '[What you\'ll be doing and why you chose it.]' },
        { date: '2025 – 2027', title: 'How I got here', text: 'Two summers of deal work back home in Austin, a student-managed fund and an angel network at Baylor, and a private equity internship at Oakdale Capital.' }
      ]
    }
  ],

  /* The short "moving" lines shown between stops (one fewer than stops). */
  travels: [
    { when: 'Summer 2015', text: 'Packing up for Texas.' },
    { when: 'Summer 2023', text: 'Up I-35 to Baylor.' },
    { when: 'June 2027', text: 'On to the Bayou City.' }
  ]
};
