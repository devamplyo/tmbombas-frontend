.PHONY: help install dev build lint clean

help:
	@echo ""
	@echo "TH Bombas - Comandos disponíveis:"
	@echo ""
	@echo "  make install   - Instala dependências"
	@echo "  make dev       - Inicia dev server (http://localhost:5173)"
	@echo "  make build     - Build de produção"
	@echo "  make lint      - Verifica estilo de código"
	@echo "  make lint-fix  - Corrige estilo automaticamente"
	@echo "  make clean     - Remove node_modules e dist"
	@echo ""

install:
	@echo "Instalando dependências..."
	@npm install
	@echo "Dependências instaladas!"

dev:
	@echo "Iniciando dev server - http://localhost:5173"
	@npm run dev

build:
	@echo "Building para produção..."
	@npm run build
	@echo "Build concluído!"

lint:
	@npm run lint

lint-fix:
	@npm run lint:fix

clean:
	@echo "Limpando projeto..."
	@rm -rf node_modules dist
	@echo "Limpeza concluída!"
