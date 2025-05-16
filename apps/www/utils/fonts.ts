import localFont from 'next/font/local'

export const monaSans = localFont({
  src: [
    {
      path: '../public/fonts/mona-sans/Mona-Sans-UltraLight.ttf',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-UltraLightItalic.ttf',
      weight: '200',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-LightItalic.ttf',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-RegularItalic.ttf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-MediumItalic.ttf',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-SemiBoldItalic.ttf',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-BoldItalic.ttf',
      weight: '700',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-ExtraBoldItalic.ttf',
      weight: '800',
      style: 'italic',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-Black.ttf',
      weight: '900',
      style: 'normal',
    },
    {
      path: '../public/fonts/mona-sans/Mona-Sans-BlackItalic.ttf',
      weight: '900',
      style: 'italic',
    },
  ],
  variable: '--font-mona-sans',
})

export const ppSupplyMono = localFont({
  src: [
    {
      path: '../public/fonts/pp-supply-mono/PPSupplyMono-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/pp-supply-mono/PPSupplyMono-Ultralight.otf',
      weight: '200',
      style: 'normal',
    },
  ],
  variable: '--font-pp-supply-mono',
})

export const ppSupplySans = localFont({
  src: [
    {
      path: '../public/fonts/pp-supply-mono/PPSupplySans-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/pp-supply-mono/PPSupplySans-Ultralight.otf',
      weight: '200',
      style: 'normal',
    },
  ],
  variable: '--font-pp-supply-sans',
})
