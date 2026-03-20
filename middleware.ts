import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASSWORD

  if (!user || !pass) return NextResponse.next()

  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const encoded = authHeader.split(' ')[1]
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    const [incomingUser, incomingPass] = decoded.split(':')
    if (incomingUser === user && incomingPass === pass) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Yard"' },
  })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
