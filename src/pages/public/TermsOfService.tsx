import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const TermsOfService = () => {
    return (
        <div className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
            <div className="max-w-4xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <header className="text-center space-y-4">
                    <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Termos de Serviço</h1>
                    <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">GPM Nexus • Última atualização: 23 de Janeiro de 2026</p>
                </header>

                <Separator className="bg-primary/10" />

                <ScrollArea className="h-[70vh] rounded-xl border border-primary/5 bg-card/30 p-8 shadow-2xl backdrop-blur-sm">
                    <div className="space-y-8 text-sm md:text-base leading-relaxed text-foreground/80">
                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">1. Aceitação dos Termos</h2>
                            <p>
                                Ao acessar e utilizar o GPM Nexus, você concorda em cumprir e estar vinculado a estes Termos de Serviço. Se você não concordar com qualquer parte destes termos, não deverá utilizar o aplicativo.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">2. Descrição do Serviço</h2>
                            <p>
                                O GPM Nexus é uma plataforma de CRM e gestão comercial que oferece ferramentas de acompanhamento de leads, integração com calendários (Google Calendar), gestão de contratos e análise de dados.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">3. Integrações com Terceiros (Google)</h2>
                            <p>
                                Nosso serviço permite a integração com APIs do Google para sincronização de agenda.
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Você é responsável por autorizar o acesso do GPM Nexus à sua conta Google.</li>
                                <li>O uso de dados recebidos das APIs do Google aderirá à Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.</li>
                                <li>Você pode revogar este acesso a qualquer momento através das configurações de segurança da sua conta Google ou dentro do nosso sistema.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">4. Responsabilidades do Usuário</h2>
                            <p>
                                Ao utilizar o GPM Nexus, você concorda em:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Fornecer informações precisas e mantê-las atualizadas.</li>
                                <li>Manter a confidencialidade de suas credenciais de acesso.</li>
                                <li>Não utilizar a plataforma para atividades ilícitas, abusivas ou que violem direitos de terceiros.</li>
                                <li>Garantir que possui permissão legal para inserir dados de terceiros (leads/clientes) no sistema, em conformidade com a LGPD.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">5. Propriedade Intelectual</h2>
                            <p>
                                Todo o conteúdo, design, código e marcas associadas ao GPM Nexus são de propriedade exclusiva de seus desenvolvedores. O uso do serviço não concede a você nenhum direito de propriedade intelectual sobre o software.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">6. Limitação de Responsabilidade</h2>
                            <p>
                                O GPM Nexus é fornecido "como está". Não garantimos que o serviço será ininterrupto ou livre de erros. Não nos responsabilizamos por perdas de dados ou lucros cessantes decorrentes do uso da plataforma ou de falhas em integrações de terceiros.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">7. Alterações nos Termos</h2>
                            <p>
                                Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão notificadas através do e-mail cadastrado ou aviso no sistema. O uso continuado após tais alterações constitui aceitação dos novos termos.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-primary uppercase border-l-4 border-primary pl-4">8. Foro</h2>
                            <p>
                                Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida no foro da comarca onde a empresa operadora do GPM Nexus estiver sediada.
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

export default TermsOfService;
