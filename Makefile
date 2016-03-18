
all:
	npm install
	node_modules/electron-packager/cli.js . Perro --platform=darwin --arch=x64 --version=0.37.2 --icon=perro.icns --overwrite

clean:
	rm -rf node_modules
	rm -rf Perro-*
