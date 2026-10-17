import type { Metadata } from 'next';
export const metadata:Metadata={title:'Otak Together',description:'A two-player collaborative cooking game.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body style={{margin:0}}>{children}</body></html>}
