import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
            <div className="max-w-4xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <header className="text-center space-y-4">
                    <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Política de Privacidade</h1>
                    <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest tracking-widest">GPM Nexus • Última atualização: 23 de Janeiro de 2026</p>
                </header>

                <Separator className="bg-primary/10" />

                <ScrollArea className="h-[70vh] rounded-xl border border-primary/5 bg-card/30 p-8 shadow-2xl backdrop-blur-sm">
                    <div className="space-y-8 text-sm md:text-base leading-relaxed text-foreground/80">
                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">1. Introdução</h2>
                            <p>
                                Bem-vindo ao GPM Nexus. Sua privacidade é de extrema importância para nós. Esta Política de Privacidade explica como coletamos, usamos, protegemos e compartilhamos suas informações ao utilizar nosso aplicativo e serviços, incluindo nossas integrações com o Google Calendar e outros serviços de terceiros através da Google Cloud Platform.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">2. Coleta de Dados via Integração Google</h2>
                            <p>
                                Nosso aplicativo solicita acesso ao seu Google Calendar (Agenda) para sincronizar compromissos, agendar reuniões e gerenciar follow-ups do CRM diretamente na sua conta Google.
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>O que acessamos:</strong> Somente os eventos da agenda necessários para a funcionalidade do CRM.</li>
                                <li><strong>Uso dos dados:</strong> As informações são usadas exclusivamente para exibir sua disponibilidade e criar novos compromissos vinculados aos seus leads e clientes.</li>
                                <li><strong>Armazenamento:</strong> Não armazenamos cópias permanentes dos seus dados pessoais da agenda, exceto as referências necessárias para manter a sincronização ativa.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">3. Informações que Coletamos</h2>
                            <p>
                                Além dos dados de integração, coletamos:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Dados de Registro:</strong> Nome, e-mail e informações da empresa para criação de conta.</li>
                                <li><strong>Dados de CRM:</strong> Informações de leads e clientes que você insere manualmente ou via Integrações de Webhook (como dados de formulários e quizzes).</li>
                                <li><strong>Logs de Uso:</strong> Informações técnicas sobre como você interage com o sistema para fins de suporte e melhoria contínua.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">4. Compartilhamento de Dados</h2>
                            <p>
                                Nós não vendemos seus dados para terceiros. Compartilhamos informações apenas quando necessário para:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Fornecer o serviço (ex: provedores de hospedagem e banco de dados como Supabase).</li>
                                <li>Cumprir obrigações legais.</li>
                                <li>Proteger a segurança e integridade de nossos sistemas.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">5. Segurança</h2>
                            <p>
                                Implementamos medidas de segurança técnicas e organizacionais rigorosas para proteger seus dados contra acesso não autorizado, alteração ou destruição. Utilizamos criptografia em trânsito e em repouso.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">6. Seus Direitos</h2>
                            <p>
                                Você tem o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento através das configurações do seu perfil ou entrando em contato com nosso suporte.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">7. Contato</h2>
                            <p>
                                Se você tiver dúvidas sobre esta política, entre em contato conosco através do e-mail de suporte associado à sua conta.
                            </p>
                        </section>
                    </div>
                </ScrollArea>

                <footer className="text-center pt-8">
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">&copy; 2026 GPM Nexus. Todos os direitos reservados.</p>
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
