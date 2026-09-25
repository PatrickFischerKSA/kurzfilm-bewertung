import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Kurzfilm Heimat · Gemeinsam bewerten',description:'Das gemeinsame Bewertungsraster für Deutsch und Kommunikation. Zwei Fachnoten, ein Bewertungsraum.',robots:{index:false,follow:false},referrer:'no-referrer',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="de-CH"><body>{children}</body></html>;}
